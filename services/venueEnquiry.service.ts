import { ActivityType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { NotFoundError, ValidationError } from '@/lib/errors';
import {
  ACTION_ORDER, eventLabel, functionLabel, historyFor, nextAction, sourceLabel, validateNewEnquiry,
  type FollowUp, type NewEnquiry, type NextAction,
} from '@/lib/venue/enquiry';
import { quoteStage } from '@/lib/venue/quotation';
import { effectiveScope } from '@/lib/ownership/scope';
import { can } from '@/lib/auth/permissions';
import { platformMatchService, type PlatformMatchRef } from '@/services/platformMatch.service';
import { assignable, venuePeople, type Assignable } from '@/services/venuePeople';

// A venue's OWN enquiries (Phase C, docs/wedding-os/15-record-ownership.md §5). Always called inside the venue's scope
// (lib/ownership/venueEntry.ts): the database guard limits every query here to that venue's business, so this file never names a
// business and cannot reach anyone else's records. An enquiry is stored as a Consultation (the same record the /plan wizard
// makes), with its channel, so the later steps — quotation, booking, wedding — reuse the existing services.
//
// Giving out follow-ups (13 Oct 2026): a follow-up can be given to someone in the business, by the owner or a member with the
// `tasks` permission — and only to a person who may work enquiries themselves, because following up means calling the couple and
// they must be able to open the enquiry (services/venuePeople.ts). The person sees it in "Your work" (services/venueMyWork.service.ts).
//
// Every enquiry, typed once (11 Nov 2026, Vivah OS phase 1): `intake` is the ONE way an enquiry enters a venue — the team's
// "+ New Enquiry" and the couple's own form on the venue's enquiry page (services/enquiryPage.service.ts) both use it. It finds the
// venue's client by mobile (BusinessClient), so a second enquiry from the same number is added to their open enquiry instead of a
// new stranger; records where it came from; and gives the enquiry to someone — the person who typed it, or the venue's owner.

const CONTACT_TYPES = ['CALL', 'WHATSAPP'] as const;
const LOG_TYPES = { CALL: ActivityType.CALL, WHATSAPP: ActivityType.WHATSAPP, NOTE: ActivityType.NOTE } as const;
export type LogKind = keyof typeof LOG_TYPES;

// On the venue's enquiry when Shaadi Shopping brought the couple (D4, or handed over) — commission applies.
export const VIA_SHAADI_SHOPPING_NOTE = 'This couple came to you through Shaadi Shopping — commission applies to this booking';

const istToday = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

// What they asked for, in one readable block — written to the history when the enquiry came from outside, or was added to an open
// one, so the team sees exactly what was sent.
export function askedFor(e: NewEnquiry): string {
  const date = e.weddingDate ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${e.weddingDate}T12:00:00+05:30`)) : 'date not decided';
  const line = [
    eventLabel(e.eventType),
    date,
    e.days > 1 ? `${e.days} days` : null,
    e.functions.length ? e.functions.map(functionLabel).join(', ') : null,
    e.guestCount > 0 ? `${e.guestCount.toLocaleString('en-IN')} guests` : null,
    e.budget ? `budget ₹${e.budget.toLocaleString('en-IN')}` : null,
  ].filter(Boolean).join(' · ');
  return e.need ? `${line}\n${e.need}` : line;
}
const istNoon = (day: string) => new Date(`${day}T12:00:00+05:30`);

export interface VenueEnquiryListItem {
  id: string;
  name: string;
  phone: string;
  event: string | null; // what they are celebrating, when it is not a wedding ("Birthday") — a wedding needs no label
  weddingDate: string | null;
  guestCount: number | null;
  channel: string; // where it came from, in words ("Google · Enquiry page")
  viaShaadiShopping: boolean; // D4: Shaadi Shopping brought this couple to this venue — commission applies
  next: NextAction;
  createdAt: string;
}

export interface VenueEnquiryDetail extends VenueEnquiryListItem {
  eventLabel: string; // "Wedding", "Birthday" …
  days: number;
  functions: string[]; // a wedding's functions, in words
  budget: number | null; // whole rupees, when they said
  handledBy: { id: string; name: string } | null; // the person this enquiry is with
  earlierEnquiries: number; // other enquiries from the same client at this venue ("already a client")
  need: string | null;
  followUps: FollowUp[];
  history: { id: string; type: string; summary: string; detail: string | null; at: string }[];
  // This member may give the follow-ups out, and to whom (people who may work enquiries; with what the ready WhatsApp message
  // needs). Empty unless canAssign.
  canAssign: boolean;
  team: Assignable[];
  businessName: string;
}

export interface VenueEnquiryDeps {
  db: Pick<typeof prisma, '$transaction'> & {
    consultation: Pick<typeof prisma.consultation, 'findMany' | 'findUnique' | 'findFirst' | 'count' | 'create' | 'update'>;
    businessClient: Pick<typeof prisma.businessClient, 'upsert'>;
    task: Pick<typeof prisma.task, 'create' | 'updateMany'>;
    businessMember: Pick<typeof prisma.businessMember, 'findMany' | 'findFirst'>;
    activityLog: Pick<typeof prisma.activityLog, 'create'>;
    business: Pick<typeof prisma.business, 'findUnique'>;
    paymentSubmission: Pick<typeof prisma.paymentSubmission, 'count'>;
  };
  match: Pick<typeof platformMatchService, 'find' | 'noteOnPlatformRecord'>;
  now: () => Date;
}

const defaultDeps = (): VenueEnquiryDeps => ({ db: prisma, match: platformMatchService, now: () => new Date() });

const include = {
  tasks: { where: { context: 'SALES_FOLLOWUP' as const, status: { not: 'CANCELLED' as const } }, select: { id: true, title: true, dueAt: true, status: true, assignedToId: true }, orderBy: { dueAt: 'asc' as const } },
  activities: { select: { id: true, type: true, summary: true, detail: true, createdAt: true }, orderBy: { createdAt: 'desc' as const }, take: 50 },
  // The current quotation (never one replaced by a revision) — it decides the next step (lib/venue/quotation.ts).
  quotations: { where: { status: { not: 'SUPERSEDED' as const } }, select: { status: true, validUntil: true, changesRequestedAt: true, booking: { select: { status: true } }, _count: { select: { paymentSubmissions: { where: { status: 'PENDING' as const } } } } }, orderBy: { createdAt: 'desc' as const }, take: 1 },
};

type Row = {
  id: string; name: string; phone: string; weddingDate: string; guestCount: number; channel: string | null; message: string | null; pipelineStage: string; createdAt: Date; platformMatch: string | null;
  eventType?: string; days?: number; functions?: string[]; totalBudget?: number | null; sourceDetail?: string | null; assignedToId?: string | null; clientId?: string | null;
  tasks: { id: string; title: string; dueAt: Date | null; status: string; assignedToId?: string | null }[];
  activities: { id: string; type: string; summary: string; detail: string | null; createdAt: Date }[];
  quotations?: { status: string; validUntil: Date | null; changesRequestedAt: Date | null; booking?: { status: string } | null; _count?: { paymentSubmissions: number } }[];
};

function view(r: Row, now: Date, seesMoney: boolean): VenueEnquiryDetail {
  const followUps: FollowUp[] = r.tasks.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt?.toISOString() ?? null, done: t.status === 'DONE' }));
  const contacted = r.activities.some((a) => (CONTACT_TYPES as readonly string[]).includes(a.type));
  const q = r.quotations?.[0];
  // A sent quotation past its date is expired, whether or not the lazy expiry has marked it yet.
  const quote = q ? (q.status === 'SENT' && q.validUntil && q.validUntil < now ? 'ENDED' : quoteStage({ status: q.status, changesRequested: q.changesRequestedAt !== null })) : null;
  const kind = eventLabel(r.eventType);
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    event: kind === 'Wedding' ? null : kind,
    weddingDate: r.weddingDate || null,
    guestCount: r.guestCount > 0 ? r.guestCount : null,
    channel: sourceLabel(r.channel, r.sourceDetail),
    viaShaadiShopping: r.platformMatch !== null,
    // "Won" with a confirmed booking is the booked customer (the wedding was created — the stage moves to Won with it), never
    // "not going ahead": only a lost enquiry, or one won some other way with no booking here, is closed.
    next: nextAction({ name: r.name, contacted, closed: r.pipelineStage === 'LOST' || (r.pipelineStage === 'WON' && q?.booking?.status !== 'CONFIRMED'), followUps, quote, booked: q?.booking?.status === 'CONFIRMED', paymentToCheck: seesMoney && (q?._count?.paymentSubmissions ?? 0) > 0 }, now),
    createdAt: r.createdAt.toISOString(),
    eventLabel: kind,
    days: r.days && r.days > 0 ? r.days : 1,
    functions: (r.functions ?? []).map(functionLabel),
    budget: r.totalBudget && r.totalBudget > 0 ? r.totalBudget : null,
    handledBy: null,
    earlierEnquiries: 0,
    need: r.message,
    followUps,
    history: r.activities.map((a) => ({ id: a.id, type: a.type, summary: a.summary, detail: a.detail, at: a.createdAt.toISOString() })),
    canAssign: false,
    team: [],
    businessName: '',
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
      await deps.db.activityLog.create({ data: { type: ActivityType.STATUS_CHANGED, summary: VIA_SHAADI_SHOPPING_NOTE, consultation: { connect: { id } } } });
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
      // "Says they have paid" is a money matter: only a member who may see money is told (the others cannot act on it).
      const seesMoney = can(effectiveScope(), 'view_financials');
      const rows = (await deps.db.consultation.findMany({ include, orderBy: { createdAt: 'desc' }, take: 300 })) as Row[];
      return rows
        .map((r) => view(r, now, seesMoney))
        .sort((a, b) => ACTION_ORDER.indexOf(a.next.kind) - ACTION_ORDER.indexOf(b.next.kind))
        .map(({ need: _need, followUps: _f, history: _h, canAssign: _c, team: _t, businessName: _b, eventLabel: _k, days: _d, functions: _fn, budget: _bu, handledBy: _hb, earlierEnquiries: _ee, ...item }) => item);
    },

    // The mark on "Enquiries" in the menu: how many "I have paid" claims from this business's own couples wait to be checked.
    // A claim belongs to the business through its quotation, so the guard counts this business's only. A money matter: a member
    // who may not see money is told nothing.
    async paymentsToCheck(): Promise<number> {
      if (!can(effectiveScope(), 'view_financials')) return 0;
      return deps.db.paymentSubmission.count({ where: { status: 'PENDING', quotation: { status: 'ACCEPTED' } } });
    },

    // The history leaves out what has been paid and invoiced for a member who may not see money (a manager, by default).
    async get(id: string): Promise<VenueEnquiryDetail> {
      const seesMoney = can(effectiveScope(), 'view_financials');
      const row = await load(id);
      const detail = view(row, deps.now(), seesMoney);
      const people = venuePeople(deps.db);
      const given = await people.names([...row.tasks.map((t) => t.assignedToId), row.assignedToId]);
      const followUps = detail.followUps.map((f) => {
        const to = row.tasks.find((t) => t.id === f.id)?.assignedToId;
        return { ...f, assignee: to ? (given.get(to) ?? { id: to, name: 'Someone no longer in the team' }) : null };
      });
      const handledBy = row.assignedToId ? (given.get(row.assignedToId) ?? { id: row.assignedToId, name: 'Someone no longer in the team' }) : null;
      // "Already a client": their other enquiries at this venue (this business's only — the guard counts nothing else).
      const earlierEnquiries = row.clientId ? await deps.db.consultation.count({ where: { clientId: row.clientId, id: { not: row.id } } }) : 0;
      const canAssign = detail.next.kind !== 'CLOSED' && can(effectiveScope(), 'tasks');
      const team = canAssign ? (await people.members()).filter((p) => p.permissions.includes('enquiries')) : [];
      return { ...detail, followUps, handledBy, earlierEnquiries, history: historyFor(detail.history, seesMoney), canAssign, team: team.map(assignable), businessName: team[0]?.businessName ?? '' };
    },

    // "+ New Enquiry" — typed in by the venue's team; it is theirs to handle.
    async create(input: Record<string, unknown>, actorId: string | null): Promise<{ id: string; repeat: boolean } | { errors: Record<string, string> }> {
      const checked = validateNewEnquiry(input, istToday(deps.now()));
      if (!checked.ok) return { errors: checked.errors };
      return this.intake(checked.value, { sourceDetail: null, actorId });
    },

    // The one way an enquiry enters the venue (see the top of this file). Inside the venue's scope, so every record here — the
    // client, the enquiry, its history — is the venue's. `actorId` null = it came from outside (the couple on the enquiry page,
    // or Shaadi Shopping): it goes to the venue's owner. Returns the enquiry it was saved on; `repeat` = added to the client's open
    // enquiry.
    //
    // A repeat is handled by who sent it: an enquiry that ARRIVES by itself (the enquiry page, Shaadi Shopping; later calls,
    // WhatsApp) is added to the client's open enquiry, so a form sent twice is never two enquiries. One the TEAM types is always a
    // new enquiry — they mean it (one family's engagement and wedding can be two) — under the same client, marked "already a
    // client".
    //
    // `platformRef` (Shaadi Shopping handed this enquiry over — services/platformHandoff.service.ts): the enquiry is linked to
    // Shaadi Shopping's record, so its commission applies (D4/D5), exactly as when the venue's own enquiry matches one.
    async intake(e: NewEnquiry, how: { sourceDetail: string | null; actorId: string | null; platformRef?: PlatformMatchRef }): Promise<{ id: string; repeat: boolean }> {
      const scope = effectiveScope();
      if (scope.kind !== 'BUSINESS') throw new Error('An enquiry is always received by one business');
      const now = deps.now();
      const source = sourceLabel(e.channel, how.sourceDetail);
      const performedBy = how.actorId ? { connect: { id: how.actorId } } : undefined;
      const commissionNote = (id: string) => ({ type: ActivityType.STATUS_CHANGED, summary: VIA_SHAADI_SHOPPING_NOTE, consultation: { connect: { id } } });

      // The client: one per mobile at this venue; their latest name is kept. Two enquiries from the same number at the same moment
      // can race on the unique (business, mobile) — the second simply tries once more and finds the first's.
      const saveClient = () => deps.db.businessClient.upsert({
        where: { businessId_phone: { businessId: scope.businessId, phone: e.phone } },
        create: { phone: e.phone, name: e.name },
        update: { name: e.name },
        select: { id: true },
      });
      const client = await saveClient().catch((err: unknown) => {
        if ((err as { code?: string })?.code === 'P2002') return saveClient();
        throw err;
      });

      // Arrived by itself while the venue is still talking to them about an earlier enquiry? Add it to that one — the team sees
      // what they asked this time.
      const open = how.actorId
        ? null
        : ((await deps.db.consultation.findFirst({ where: { clientId: client.id, pipelineStage: { notIn: ['LOST', 'WON'] } }, orderBy: { createdAt: 'desc' }, select: { id: true, platformMatch: true } })) as { id: string; platformMatch: string | null } | null);
      if (open) {
        await deps.db.activityLog.create({
          data: { type: ActivityType.NOTE, summary: `Enquired again — ${source.toLowerCase()}`, detail: askedFor(e), consultation: { connect: { id: open.id } }, performedBy },
        });
        // Brought by Shaadi Shopping to an enquiry the venue already had: it is linked now, so the commission applies to it.
        if (how.platformRef && !open.platformMatch) {
          await deps.db.consultation.update({ where: { id: open.id }, data: { platformMatch: how.platformRef, platformMatchedAt: now } });
          await deps.db.activityLog.create({ data: commissionNote(open.id) });
        }
        return { id: open.id, repeat: true };
      }

      const earlier = await deps.db.consultation.count({ where: { clientId: client.id } });
      const handler = how.actorId ?? (await deps.db.businessMember.findFirst({ where: { businessId: scope.businessId, role: 'OWNER', removedAt: null }, orderBy: { createdAt: 'asc' }, select: { userId: true } }))?.userId ?? null;
      const id = await deps.db.$transaction(async (tx) => {
        const created = await tx.consultation.create({
          data: {
            name: e.name, phone: e.phone, eventType: e.eventType, weddingDate: e.weddingDate, days: e.days, functions: e.functions, guestCount: e.guestCount,
            totalBudget: e.budget, message: e.need, channel: e.channel, sourceDetail: how.sourceDetail, clientId: client.id,
            assignedToId: handler, assignedById: handler ? how.actorId : null, assignedAt: handler ? now : null,
            ...(how.platformRef ? { platformMatch: how.platformRef, platformMatchedAt: now } : {}),
          },
          select: { id: true },
        });
        await tx.activityLog.create({
          data: { type: ActivityType.STATUS_CHANGED, summary: `Enquiry added — ${source.toLowerCase()}`, detail: how.actorId ? undefined : askedFor(e), consultation: { connect: { id: created.id } }, performedBy },
        });
        if (how.platformRef) await tx.activityLog.create({ data: commissionNote(created.id) });
        if (earlier > 0) {
          await tx.activityLog.create({
            data: { type: ActivityType.NOTE, summary: `Already a client — ${earlier} earlier ${earlier === 1 ? 'enquiry' : 'enquiries'} with you`, consultation: { connect: { id: created.id } } },
          });
        }
        return created.id;
      });
      // Not handed over by Shaadi Shopping: is it still a couple Shaadi Shopping brought to this venue (D4)?
      if (!how.platformRef) await linkIfShaadiShoppingCouple(id, e.phone);
      return { id, repeat: false };
    },

    // Hand the enquiry to someone in the business who may work enquiries (or to nobody in particular). Same rule as giving out a
    // follow-up: the owner, or a member with the `tasks` permission (services/venuePeople.ts).
    async handOver(id: string, to: unknown, actorId: string | null): Promise<VenueEnquiryDetail> {
      const row = await load(id);
      const who = await venuePeople(deps.db).assignee(to, 'enquiries');
      if (!who.ok) throw new ValidationError(who.error);
      if (who.userId === (row.assignedToId ?? null)) return this.get(id);
      const name = who.userId ? (await venuePeople(deps.db).names([who.userId])).get(who.userId)?.name ?? 'someone' : null;
      await deps.db.$transaction(async (tx) => {
        await tx.consultation.update({ where: { id }, data: { assignedToId: who.userId, assignedById: actorId, assignedAt: deps.now() } });
        await tx.activityLog.create({
          data: { type: ActivityType.ASSIGNED, summary: name ? `Handed to ${name}` : 'Not with anyone in particular now', consultation: { connect: { id } }, performedBy: actorId ? { connect: { id: actorId } } : undefined },
        });
      });
      return this.get(id);
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

    async addFollowUp(id: string, input: { date?: unknown; title?: unknown; assignTo?: unknown }, actorId: string | null): Promise<VenueEnquiryDetail> {
      const date = typeof input.date === 'string' ? input.date.trim() : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ValidationError('Pick the follow-up date');
      if (date < istToday(deps.now())) throw new ValidationError('Pick today or a later date');
      const title = typeof input.title === 'string' && input.title.trim() ? input.title.trim().slice(0, 200) : 'Follow up';
      const e = await load(id);
      // Given to someone at once (`assignTo`) — optional; left out or empty = nobody in particular.
      const who = typeof input.assignTo === 'string' && input.assignTo.trim() ? await venuePeople(deps.db).assignee(input.assignTo, 'enquiries') : null;
      if (who && !who.ok) throw new ValidationError(who.error);
      await deps.db.task.create({ data: { context: 'SALES_FOLLOWUP', title, dueAt: istNoon(date), consultation: { connect: { id: e.id } }, createdBy: actorId ? { connect: { id: actorId } } : undefined, assignedTo: who?.userId ? { connect: { id: who.userId } } : undefined } });
      return this.get(id);
    },

    // Give an open follow-up to someone who may work enquiries, to someone else, or to nobody (`assignTo` empty).
    async assignFollowUp(id: string, taskId: string, assignTo: unknown): Promise<VenueEnquiryDetail> {
      await load(id); // another business's enquiry is "not found" before anything is changed
      const who = await venuePeople(deps.db).assignee(assignTo, 'enquiries');
      if (!who.ok) throw new ValidationError(who.error);
      const { count } = await deps.db.task.updateMany({ where: { id: taskId, consultationId: id, context: 'SALES_FOLLOWUP', status: { in: ['PENDING', 'IN_PROGRESS'] } }, data: { assignedToId: who.userId } });
      if (count === 0) throw new NotFoundError('Follow-up', taskId);
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
