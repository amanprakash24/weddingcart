import { ActivityType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { ACTION_ORDER, CHANNEL_LABEL, nextAction, validateNewEnquiry, type Channel, type FollowUp, type NextAction } from '@/lib/venue/enquiry';
import { effectiveScope } from '@/lib/ownership/scope';
import { platformMatchService } from '@/services/platformMatch.service';

// A venue's OWN enquiries (Phase C, docs/wedding-os/15-record-ownership.md §5). Always called inside the venue's scope
// (lib/ownership/venueEntry.ts): the database guard limits every query here to that venue's business, so this file never names a
// business and cannot reach anyone else's records. An enquiry is stored as a Consultation (the same record the /plan wizard
// makes), with its channel, so the later steps — quotation, booking, wedding — reuse the existing services.

const CONTACT_TYPES = ['CALL', 'WHATSAPP'] as const;
const LOG_TYPES = { CALL: ActivityType.CALL, WHATSAPP: ActivityType.WHATSAPP, NOTE: ActivityType.NOTE } as const;
export type LogKind = keyof typeof LOG_TYPES;

const istToday = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
const istNoon = (day: string) => new Date(`${day}T12:00:00+05:30`);

export interface VenueEnquiryListItem {
  id: string;
  name: string;
  phone: string;
  weddingDate: string | null;
  guestCount: number | null;
  channel: string;
  viaShaadiShopping: boolean; // D4: Shaadi Shopping brought this couple to this venue — commission applies
  next: NextAction;
  createdAt: string;
}

export interface VenueEnquiryDetail extends VenueEnquiryListItem {
  need: string | null;
  followUps: FollowUp[];
  history: { id: string; type: string; summary: string; detail: string | null; at: string }[];
}

export interface VenueEnquiryDeps {
  db: Pick<typeof prisma, '$transaction'> & {
    consultation: Pick<typeof prisma.consultation, 'findMany' | 'findUnique' | 'create' | 'update'>;
    task: Pick<typeof prisma.task, 'create' | 'updateMany'>;
    activityLog: Pick<typeof prisma.activityLog, 'create'>;
    business: Pick<typeof prisma.business, 'findUnique'>;
  };
  match: Pick<typeof platformMatchService, 'find' | 'noteOnPlatformRecord'>;
  now: () => Date;
}

const defaultDeps = (): VenueEnquiryDeps => ({ db: prisma, match: platformMatchService, now: () => new Date() });

const include = {
  tasks: { where: { context: 'SALES_FOLLOWUP' as const, status: { not: 'CANCELLED' as const } }, select: { id: true, title: true, dueAt: true, status: true }, orderBy: { dueAt: 'asc' as const } },
  activities: { select: { id: true, type: true, summary: true, detail: true, createdAt: true }, orderBy: { createdAt: 'desc' as const }, take: 50 },
};

type Row = {
  id: string; name: string; phone: string; weddingDate: string; guestCount: number; channel: string | null; message: string | null; pipelineStage: string; createdAt: Date; platformMatch: string | null;
  tasks: { id: string; title: string; dueAt: Date | null; status: string }[];
  activities: { id: string; type: string; summary: string; detail: string | null; createdAt: Date }[];
};

function view(r: Row, now: Date): VenueEnquiryDetail {
  const followUps: FollowUp[] = r.tasks.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt?.toISOString() ?? null, done: t.status === 'DONE' }));
  const contacted = r.activities.some((a) => (CONTACT_TYPES as readonly string[]).includes(a.type));
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    weddingDate: r.weddingDate || null,
    guestCount: r.guestCount > 0 ? r.guestCount : null,
    channel: CHANNEL_LABEL[r.channel as Channel] ?? 'Shaadi Shopping',
    viaShaadiShopping: r.platformMatch !== null,
    next: nextAction({ name: r.name, contacted, closed: r.pipelineStage === 'LOST' || r.pipelineStage === 'WON', followUps }, now),
    createdAt: r.createdAt.toISOString(),
    need: r.message,
    followUps,
    history: r.activities.map((a) => ({ id: a.id, type: a.type, summary: a.summary, detail: a.detail, at: a.createdAt.toISOString() })),
  };
}

export function createVenueEnquiryService(deps: VenueEnquiryDeps = defaultDeps()) {
  // D4: a couple Shaadi Shopping already brought to THIS venue is linked to that record — commission applies. Best effort: a failure
  // here never loses the venue's enquiry (it is saved first).
  async function linkIfShaadiShoppingCouple(id: string, phone: string): Promise<void> {
    try {
      const scope = effectiveScope();
      if (scope.kind !== 'BUSINESS') return;
      const business = await deps.db.business.findUnique({ where: { id: scope.businessId }, select: { name: true, vendorId: true, kind: true } });
      if (!business?.vendorId || business.kind !== 'VENDOR') return;
      const ref = await deps.match.find(business.vendorId, phone);
      if (!ref) return;
      await deps.db.consultation.update({ where: { id }, data: { platformMatch: ref, platformMatchedAt: deps.now() } });
      await deps.db.activityLog.create({ data: { type: ActivityType.STATUS_CHANGED, summary: 'This couple came to you through Shaadi Shopping — commission applies to this booking', consultation: { connect: { id } } } });
      await deps.match.noteOnPlatformRecord(ref, business.name);
    } catch (err) {
      console.error('D4 platform match failed (the enquiry is saved):', err instanceof Error ? err.message : err);
    }
  }

  async function load(id: string): Promise<Row> {
    const row = (await deps.db.consultation.findUnique({ where: { id }, include })) as Row | null;
    if (!row) throw new NotFoundError('Enquiry', id);
    return row;
  }

  return {
    // "Your Enquiries": what needs doing first at the top (late follow-ups, people nobody has called yet, today's follow-ups).
    async list(): Promise<VenueEnquiryListItem[]> {
      const now = deps.now();
      const rows = (await deps.db.consultation.findMany({ include, orderBy: { createdAt: 'desc' }, take: 300 })) as Row[];
      return rows
        .map((r) => view(r, now))
        .sort((a, b) => ACTION_ORDER.indexOf(a.next.kind) - ACTION_ORDER.indexOf(b.next.kind))
        .map(({ need: _need, followUps: _f, history: _h, ...item }) => item);
    },

    async get(id: string): Promise<VenueEnquiryDetail> {
      return view(await load(id), deps.now());
    },

    // "+ New Enquiry" — the record is created in the venue's business by the guard.
    async create(input: Record<string, unknown>, actorId: string | null): Promise<{ id: string } | { errors: Record<string, string> }> {
      const now = deps.now();
      const checked = validateNewEnquiry(input, istToday(now));
      if (!checked.ok) return { errors: checked.errors };
      const e = checked.value;
      const id = await deps.db.$transaction(async (tx) => {
        const created = await tx.consultation.create({
          data: { name: e.name, phone: e.phone, weddingDate: e.weddingDate, days: 1, guestCount: e.guestCount, message: e.need, channel: e.channel },
          select: { id: true },
        });
        await tx.activityLog.create({
          data: { type: ActivityType.STATUS_CHANGED, summary: `Enquiry added — ${CHANNEL_LABEL[e.channel].toLowerCase()}`, consultation: { connect: { id: created.id } }, performedBy: actorId ? { connect: { id: actorId } } : undefined },
        });
        return created.id;
      });
      await linkIfShaadiShoppingCouple(id, e.phone);
      return { id };
    },

    // "I called them" / "I sent a WhatsApp" / a note — this is what moves "Call Rahul" on to the next step.
    async log(id: string, kind: unknown, text: unknown, actorId: string | null): Promise<VenueEnquiryDetail> {
      if (kind !== 'CALL' && kind !== 'WHATSAPP' && kind !== 'NOTE') throw new ValidationError('Choose call, WhatsApp or note');
      const note = typeof text === 'string' ? text.trim() : '';
      if (kind === 'NOTE' && !note) throw new ValidationError('Write the note');
      if (note.length > 1000) throw new ValidationError('Please keep it under 1000 characters');
      await load(id);
      const summary = kind === 'CALL' ? 'Called' : kind === 'WHATSAPP' ? 'Sent a WhatsApp' : 'Note';
      await deps.db.activityLog.create({ data: { type: LOG_TYPES[kind], summary, detail: note || undefined, consultation: { connect: { id } }, performedBy: actorId ? { connect: { id: actorId } } : undefined } });
      return this.get(id);
    },

    async addFollowUp(id: string, input: { date?: unknown; title?: unknown }, actorId: string | null): Promise<VenueEnquiryDetail> {
      const date = typeof input.date === 'string' ? input.date.trim() : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ValidationError('Pick the follow-up date');
      if (date < istToday(deps.now())) throw new ValidationError('Pick today or a later date');
      const title = typeof input.title === 'string' && input.title.trim() ? input.title.trim().slice(0, 200) : 'Follow up';
      const e = await load(id);
      await deps.db.task.create({ data: { context: 'SALES_FOLLOWUP', title, dueAt: istNoon(date), consultation: { connect: { id: e.id } }, createdBy: actorId ? { connect: { id: actorId } } : undefined } });
      return this.get(id);
    },

    async completeFollowUp(id: string, taskId: string): Promise<VenueEnquiryDetail> {
      await load(id);
      await deps.db.task.updateMany({ where: { id: taskId, consultationId: id, status: { not: 'DONE' } }, data: { status: 'DONE', completedAt: deps.now() } });
      return this.get(id);
    },

    // "Not going ahead" — kept, never deleted.
    async close(id: string, reason: unknown, actorId: string | null): Promise<VenueEnquiryDetail> {
      const text = typeof reason === 'string' ? reason.trim().slice(0, 300) : '';
      await load(id);
      await deps.db.$transaction(async (tx) => {
        await tx.consultation.update({ where: { id }, data: { pipelineStage: 'LOST', lostReason: 'OTHER', lostReasonDetail: text || 'Not going ahead' } });
        await tx.task.updateMany({ where: { consultationId: id, status: { in: ['PENDING', 'IN_PROGRESS'] } }, data: { status: 'CANCELLED' } });
        await tx.activityLog.create({ data: { type: ActivityType.STATUS_CHANGED, summary: 'Not going ahead', detail: text || undefined, consultation: { connect: { id } }, performedBy: actorId ? { connect: { id: actorId } } : undefined } });
      });
      return this.get(id);
    },
  };
}

export const venueEnquiryService = createVenueEnquiryService();
