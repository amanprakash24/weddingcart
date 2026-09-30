// Vendor enquiry & response (blueprint §43, docs/wedding-os/04-vendor-os.md §9).
//
// syncForSource keeps one enquiry per vendor linked to a customer record (on the consultation or on the current quote)
// — called after a quote is saved/revised/discarded and after a consultation vendor choice changes. It never blocks
// those actions: callers run it best-effort. Answers come from the vendor (Vendor OS) or from staff recording what the
// vendor told them; both go through the same validation. The customer never sees any of this.
import { prisma } from '@/lib/prisma';
import { NotFoundError, ConflictError } from '@/lib/errors';
import { subjectCreateData, subjectWhere } from '@/lib/crm/subject';
import type { SourceType } from '@/services/leadInbox.service';
import {
  answerSummary,
  buildDesired,
  CHANNEL_LABEL,
  planSync,
  staffAlerts,
  toVendorEnquiryView,
  validateAnswer,
  VENDOR_CHANNEL,
  type AnswerInput,
  type StaffChannel,
  type VendorEnquiryRow,
  type VendorEnquiryView,
} from '@/lib/vendorEnquiry/rules';
import type { BookingSource } from '@/lib/quotation/booking';
// Namespace imports, looked up when called: tests that replace these modules with partial stubs can still load this one.
import * as quotationModule from '@/services/quotation.service';
import * as venuePortalModule from '@/services/venuePortal.service';
import * as activityLogModule from '@/repositories/activityLog.repository';

export const sourceKeyOf = (sourceType: SourceType, sourceId: string) => `${sourceType}:${sourceId}`;

function parseSourceKey(key: string): { sourceType: SourceType; sourceId: string } {
  const i = key.indexOf(':');
  return { sourceType: key.slice(0, i) as SourceType, sourceId: key.slice(i + 1) };
}

type Db = typeof prisma;

export interface VendorEnquiryDeps {
  db: {
    vendorEnquiry: Pick<Db['vendorEnquiry'], 'findMany' | 'findFirst' | 'create' | 'update'>;
    quotation: Pick<Db['quotation'], 'findFirst'>;
    consultationVendorSelection: Pick<Db['consultationVendorSelection'], 'findMany'>;
    vendor: Pick<Db['vendor'], 'findMany'>;
  };
  sourceFacts: (sourceType: SourceType, sourceId: string) => Promise<BookingSource>;
  logActivity: (data: { type: 'VENDOR_ENQUIRY_SENT' | 'VENDOR_ENQUIRY_ANSWERED'; summary: string; detail: string | null; sourceType: SourceType; sourceId: string; actorId: string | null }) => Promise<void>;
  vendorIdForUser: (userId: string) => Promise<string>;
}

export interface StaffEnquiryView {
  id: string;
  vendorId: string;
  vendorName: string;
  status: VendorEnquiryRow['status'];
  services: string;
  functions: string | null;
  eventDate: string | null;
  responseNote: string | null;
  suggestedDate: string | null;
  quotedAmount: number | null;
  answeredVia: string | null;
  answeredAt: string | null;
  askedAt: string;
}

export function createVendorEnquiryService(deps: VendorEnquiryDeps) {
  const { db } = deps;

  async function vendorNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await db.vendor.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    return new Map(rows.map((v) => [v.id, v.name]));
  }

  async function facts(sourceType: SourceType, sourceId: string) {
    if (sourceType === 'LEAD') return null;
    try {
      return await deps.sourceFacts(sourceType, sourceId);
    } catch {
      return null;
    }
  }

  return {
    // Reconcile the enquiries for one customer record with the vendors currently linked to it.
    async syncForSource(sourceType: SourceType, sourceId: string, actorId: string | null): Promise<{ created: number; refreshed: number; reopened: number; withdrawn: number }> {
      const where = subjectWhere(sourceType, sourceId);
      // The current quote: the accepted one, else the newest open one. Replaced/declined/expired quotes don't count.
      const quote =
        (await db.quotation.findFirst({ where: { ...where, status: 'ACCEPTED' }, include: { items: true } })) ??
        (await db.quotation.findFirst({ where: { ...where, status: { in: ['DRAFT', 'SENT'] } }, orderBy: { createdAt: 'desc' }, include: { items: true } }));
      const selections =
        sourceType === 'CONSULTATION' ? await db.consultationVendorSelection.findMany({ where: { consultationId: sourceId }, select: { vendorId: true, serviceKey: true } }) : [];
      const f = await facts(sourceType, sourceId);
      const desired = buildDesired({
        quotationId: quote?.id ?? null,
        lines: (quote?.items ?? []).map((i) => ({ vendorId: i.vendorId, category: i.category, description: i.description, functionLabel: i.functionLabel })),
        selections,
        facts: f ? { dateText: f.dateText, guestCount: f.guestCount, city: f.city, eventType: f.eventType } : null,
      });
      const key = sourceKeyOf(sourceType, sourceId);
      const existing = await db.vendorEnquiry.findMany({ where: { sourceKey: key } });
      const plan = planSync(desired, existing as never);
      const names = await vendorNames(plan.create.map((d) => d.vendorId).concat(existing.filter((e) => plan.reopen.some((r) => r.id === e.id)).map((e) => e.vendorId)));

      for (const d of plan.create) {
        await db.vendorEnquiry.create({
          data: {
            vendor: { connect: { id: d.vendorId } },
            sourceKey: key,
            ...subjectCreateData(sourceType, sourceId),
            quotation: d.quotationId ? { connect: { id: d.quotationId } } : undefined,
            services: d.services,
            functions: d.functions,
            eventDate: d.eventDate,
            guestCount: d.guestCount,
            city: d.city,
            eventType: d.eventType,
          },
        });
        await deps.logActivity({ type: 'VENDOR_ENQUIRY_SENT', summary: `Availability enquiry sent to ${names.get(d.vendorId) ?? 'a vendor'} (${d.services})`, detail: null, sourceType, sourceId, actorId });
      }
      for (const r of plan.refresh) {
        await db.vendorEnquiry.update({ where: { id: r.id }, data: { ...r.details } });
      }
      for (const r of plan.reopen) {
        const vendorId = existing.find((e) => e.id === r.id)?.vendorId ?? '';
        await db.vendorEnquiry.update({
          where: { id: r.id },
          data: { ...r.details, status: 'PENDING', responseNote: null, suggestedDate: null, quotedAmount: null, responseChannel: null, respondedAt: null, respondedById: null },
        });
        await deps.logActivity({ type: 'VENDOR_ENQUIRY_SENT', summary: `Availability enquiry sent again to ${names.get(vendorId) ?? 'a vendor'} (${r.details.services})`, detail: null, sourceType, sourceId, actorId });
      }
      for (const id of plan.withdraw) {
        await db.vendorEnquiry.update({ where: { id }, data: { status: 'WITHDRAWN' } });
      }
      return { created: plan.create.length, refreshed: plan.refresh.length, reopened: plan.reopen.length, withdrawn: plan.withdraw.length };
    },

    // Staff: every enquiry for a customer record, with vendor names, plus the warnings to act on.
    async listForSource(sourceType: SourceType, sourceId: string): Promise<{ enquiries: StaffEnquiryView[]; alerts: string[] }> {
      const rows = await db.vendorEnquiry.findMany({ where: { sourceKey: sourceKeyOf(sourceType, sourceId) }, orderBy: { createdAt: 'asc' } });
      const names = await vendorNames([...new Set(rows.map((r) => r.vendorId))]);
      const enquiries = rows.map((r) => ({
        id: r.id,
        vendorId: r.vendorId,
        vendorName: names.get(r.vendorId) ?? 'Vendor',
        status: r.status,
        services: r.services,
        functions: r.functions,
        eventDate: r.eventDate,
        responseNote: r.responseNote,
        suggestedDate: r.suggestedDate,
        quotedAmount: r.quotedAmount,
        answeredVia: r.responseChannel ? CHANNEL_LABEL[r.responseChannel] ?? r.responseChannel : null,
        answeredAt: r.respondedAt ? r.respondedAt.toISOString() : null,
        askedAt: r.createdAt.toISOString(),
      }));
      return { enquiries, alerts: staffAlerts(enquiries.filter((e) => e.status !== 'WITHDRAWN')) };
    },

    // Staff record what the vendor told them (phone / WhatsApp / in person / other).
    async answerAsStaff(id: string, input: AnswerInput, channel: StaffChannel, actorId: string | null): Promise<StaffEnquiryView['status']> {
      const answer = validateAnswer(input);
      const row = await db.vendorEnquiry.findFirst({ where: { id } });
      if (!row) throw new NotFoundError('Vendor enquiry', id);
      if (row.status === 'WITHDRAWN') throw new ConflictError('This vendor is no longer linked to the customer');
      await db.vendorEnquiry.update({
        where: { id },
        data: { status: answer.status, responseNote: answer.note, suggestedDate: answer.suggestedDate, quotedAmount: answer.quotedAmount, responseChannel: channel, respondedAt: new Date(), respondedById: actorId },
      });
      const name = (await vendorNames([row.vendorId])).get(row.vendorId) ?? 'The vendor';
      const { sourceType, sourceId } = parseSourceKey(row.sourceKey);
      await deps.logActivity({ type: 'VENDOR_ENQUIRY_ANSWERED', summary: `${name} answered: ${answerSummary(answer)} (recorded by staff via ${CHANNEL_LABEL[channel]})`, detail: answer.note, sourceType, sourceId, actorId });
      return answer.status;
    },

    // Vendor OS: the logged-in vendor's own enquiries (newest first), as the vendor may see them.
    async listForVendor(userId: string): Promise<VendorEnquiryView[]> {
      const vendorId = await deps.vendorIdForUser(userId);
      const rows = await db.vendorEnquiry.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' }, take: 100 });
      return rows.map((r) => toVendorEnquiryView(r as never));
    },

    // Vendor OS: answer one of the vendor's OWN enquiries. Any other id → the same "not found".
    async answerAsVendor(userId: string, id: unknown, input: AnswerInput): Promise<VendorEnquiryView> {
      const vendorId = await deps.vendorIdForUser(userId);
      if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundError('Vendor enquiry', 'unavailable');
      const answer = validateAnswer(input);
      const row = await db.vendorEnquiry.findFirst({ where: { id, vendorId } });
      if (!row) throw new NotFoundError('Vendor enquiry', 'unavailable');
      if (row.status === 'WITHDRAWN') throw new ConflictError('This enquiry is no longer needed — nothing more to do');
      const updated = await db.vendorEnquiry.update({
        where: { id },
        data: { status: answer.status, responseNote: answer.note, suggestedDate: answer.suggestedDate, quotedAmount: answer.quotedAmount, responseChannel: VENDOR_CHANNEL, respondedAt: new Date(), respondedById: userId },
      });
      const name = (await vendorNames([vendorId])).get(vendorId) ?? 'The vendor';
      const { sourceType, sourceId } = parseSourceKey(row.sourceKey);
      await deps.logActivity({ type: 'VENDOR_ENQUIRY_ANSWERED', summary: `${name} answered in Vendor OS: ${answerSummary(answer)}`, detail: answer.note, sourceType, sourceId, actorId: userId });
      return toVendorEnquiryView(updated as never);
    },
  };
}

// ---- the real wiring ----------------------------------------------------------------------------------------------

function defaultDeps(): VendorEnquiryDeps {
  return {
    db: prisma,
    sourceFacts: (sourceType, sourceId) => quotationModule.bookingSourceFacts(sourceType, sourceId, prisma),
    logActivity: async ({ type, summary, detail, sourceType, sourceId, actorId }) => {
      await activityLogModule.activityLogRepository.create({
        type,
        summary,
        detail,
        performedBy: actorId ? { connect: { id: actorId } } : undefined,
        ...subjectCreateData(sourceType, sourceId),
      });
    },
    vendorIdForUser: async (userId) => (await venuePortalModule.vendorForUser(userId)).vendorId,
  };
}

export const vendorEnquiryService = createVendorEnquiryService(defaultDeps());
