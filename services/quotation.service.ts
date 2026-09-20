import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { ActivityType } from '@/generated/prisma/enums';
import type { PipelineStage } from '@/generated/prisma/enums';
import { ConflictError, DuplicateError, NotFoundError, ValidationError } from '@/lib/errors';
import { describeSourceConflict } from '@/lib/quotation/conflict';
import { isSourceKeyRule } from '@/lib/duplicateConstraint';
import { subjectCreateData, subjectWhere } from '@/lib/crm/subject';
import { canTransition } from '@/lib/crm/pipeline';
import { lockNumberBucket, monthBucket, nextSequenceNumber } from '@/lib/numbering';
import { calculateQuotationTotals } from '@/lib/quotation/totals';
import { formatQuoteDate } from '@/lib/quotation/message';
import { planBookingFromQuotation, type BookingOverrides, type BookingSource } from '@/lib/quotation/booking';
import {
  evaluateAcceptable,
  evaluateBookable,
  evaluateDeletable,
  evaluateEditable,
  evaluateQuotable,
  evaluateRejectable,
  evaluateRevisable,
  evaluateSendable,
  statusAfterRevisionDiscarded,
  type AcceptanceChannel,
} from '@/lib/quotation/rules';
import { quotationRepository, type QuotationWithItems } from '@/repositories/quotation.repository';
import { activityLogRepository } from '@/repositories/activityLog.repository';
import { bookingRepository } from '@/repositories/booking.repository';
import { enquiryRepository } from '@/repositories/enquiry.repository';
import { consultationRepository } from '@/repositories/consultation.repository';
import { leadRepository } from '@/repositories/lead.repository';
import { findWeddingForSource } from '@/services/weddingConversion.service';
import { leadWorkspaceService } from '@/services/leadWorkspace.service';
import type { SourceType } from '@/services/leadInbox.service';

// Quotation workflow (docs/wedding-os/08-quotation.md).
//   S1: create / edit / list / delete a DRAFT.
//   S2: send / revise / accept / reject / expire, activity trail, pipeline coupling.
//   S3: create a Booking from an accepted quotation.
// The automatic advance invoice is S4.
//
// Every mutation runs in one transaction behind advisory locks on the source and the quotation, so
// concurrent requests are serialized; the database's partial unique indexes (one open and one accepted
// quotation per source) are the backstop.

type Tx = Prisma.TransactionClient;

export interface QuotationItemInput {
  description: string;
  category?: string | null;
  functionLabel?: string | null;
  vendorId?: string | null;
  unitPrice: number;
  quantity: number;
}

export interface QuotationInput {
  items: QuotationItemInput[];
  discount?: number;
  gstEnabled?: boolean;
  gstAmount?: number;
  advanceAmount?: number;
  validUntil?: Date | null;
  terms?: string | null;
  notes?: string | null;
}

const SOURCE_LABEL: Record<SourceType, string> = { LEAD: 'lead', ENQUIRY: 'enquiry', CONSULTATION: 'consultation' };
const CHANNEL_LABEL: Record<AcceptanceChannel, string> = {
  WHATSAPP: 'WhatsApp',
  PHONE: 'phone',
  IN_PERSON: 'in person',
  OTHER: 'another channel',
};
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// API shape: the stored row plus what is derived from it and must never be stored.
export function toQuotationView(q: QuotationWithItems) {
  return {
    ...q,
    balance: q.total - q.advanceAmount,
    items: q.items.map((item) => ({ ...item, lineTotal: item.unitPrice * item.quantity })),
  };
}
export type QuotationView = ReturnType<typeof toQuotationView>;

// Transaction-scoped advisory locks, same mechanism as weddingConversion's — serialize concurrent
// writers for one key; released automatically at commit/rollback. Keys are sorted so callers that take
// several always acquire them in the same order (no deadlocks).
async function lockMany(tx: Tx, keys: string[]): Promise<void> {
  for (const key of [...new Set(keys)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }
}

const sourceKey = (sourceType: SourceType, sourceId: string) => `QUOTATION:${sourceType}:${sourceId}`;

function sourceOf(q: { enquiryId: string | null; consultationId: string | null; leadId: string | null }): {
  sourceType: SourceType;
  sourceId: string;
} {
  if (q.enquiryId) return { sourceType: 'ENQUIRY', sourceId: q.enquiryId };
  if (q.consultationId) return { sourceType: 'CONSULTATION', sourceId: q.consultationId };
  return { sourceType: 'LEAD', sourceId: q.leadId as string };
}

// Loads a quotation, takes the source + quotation locks, and RE-READS it under the lock, so the
// state checks that follow can't be raced by a concurrent request.
async function loadLocked(tx: Tx, id: string) {
  const first = await quotationRepository.findById(id, tx);
  if (!first) throw new NotFoundError('Quotation', id);
  const source = sourceOf(first);
  await lockMany(tx, [sourceKey(source.sourceType, source.sourceId), `QUOTATION:${id}`]);
  const q = await quotationRepository.findById(id, tx);
  if (!q) throw new NotFoundError('Quotation', id);
  return { q, ...source };
}

async function loadSource(sourceType: SourceType, id: string, tx: Tx | typeof prisma): Promise<unknown | null> {
  if (sourceType === 'ENQUIRY') return enquiryRepository.findById(id, tx);
  if (sourceType === 'CONSULTATION') return consultationRepository.findById(id, tx);
  return leadRepository.findById(id, tx);
}

// A SENT quotation past its valid-until date is EXPIRED. There is no scheduler in V1, so this is applied
// lazily whenever quotations are read or acted on — which also frees the source's "open quotation" slot.
async function expireOverdue(where: Prisma.QuotationWhereInput, tx: Tx | typeof prisma = prisma): Promise<void> {
  await tx.quotation.updateMany({
    where: { ...where, status: 'SENT', validUntil: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
}

async function logEvent(
  tx: Tx,
  sourceType: SourceType,
  sourceId: string,
  type: ActivityType,
  summary: string,
  detail: string | null,
  actorId: string | null
): Promise<void> {
  await activityLogRepository.create(
    {
      type,
      summary,
      detail,
      performedBy: actorId ? { connect: { id: actorId } } : undefined,
      ...subjectCreateData(sourceType, sourceId),
    },
    tx
  );
}

// Validates the money and returns everything that gets persisted. Totals are always
// recomputed here — a client-sent total is never read.
function prepare(input: QuotationInput) {
  const gstAmount = input.gstAmount ?? 0;
  const gstEnabled = input.gstEnabled ?? false;
  if (gstAmount > 0 && !gstEnabled) {
    throw new ValidationError('Turn tax on to enter a tax amount');
  }
  if (input.items.length === 0) {
    throw new ValidationError('Add at least one line item');
  }
  const totals = calculateQuotationTotals({
    items: input.items,
    discount: input.discount,
    gstAmount,
    advanceAmount: input.advanceAmount,
  });
  return { totals, gstEnabled };
}

async function assertVendorsExist(items: QuotationItemInput[], tx: Tx | typeof prisma): Promise<void> {
  const ids = [...new Set(items.map((i) => i.vendorId).filter((v): v is string => !!v))];
  if (ids.length === 0) return;
  const found = await tx.vendor.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const foundIds = new Set(found.map((v) => v.id));
  const missing = ids.find((id) => !foundIds.has(id));
  if (missing) throw new NotFoundError('Vendor', missing);
}

function itemRows(items: QuotationItemInput[]) {
  return items.map((item, index) => ({
    sortOrder: index + 1,
    description: item.description.trim(),
    category: item.category?.trim() || null,
    functionLabel: item.functionLabel?.trim() || null,
    vendorId: item.vendorId || null,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
  }));
}

// What a Booking needs from an Enquiry or Consultation. Both keep their date as free text, so the date
// is handed over as text and only trusted by planBookingFromQuotation if it is a clear YYYY-MM-DD.
async function bookingSourceFacts(sourceType: SourceType, sourceId: string, tx: Tx): Promise<BookingSource> {
  if (sourceType === 'ENQUIRY') {
    const e = await enquiryRepository.findById(sourceId, tx);
    if (!e) throw new NotFoundError('Enquiry', sourceId);
    const guests = Number(e.guestCount);
    return {
      name: e.name,
      phone: e.phone,
      city: e.city,
      dateText: e.eventDate,
      guestCount: Number.isInteger(guests) && guests > 0 ? guests : null,
      eventType: e.eventType,
    };
  }
  const c = await consultationRepository.findById(sourceId, tx);
  if (!c) throw new NotFoundError('Consultation', sourceId);
  return { name: c.name, phone: c.phone, city: c.city, dateText: c.weddingDate, guestCount: c.guestCount > 0 ? c.guestCount : null, eventType: c.eventType };
}

// A unique-rule violation on a lead's quotations (one open / one accepted) is turned into a sentence naming the quotations that
// are really there, read FRESH (outside the failed transaction). Any other error passes through unchanged.
export async function explainSourceConflict(err: unknown, source: { sourceType: SourceType; sourceId: string } | null): Promise<unknown> {
  if (!(err instanceof DuplicateError) || !source) return err;
  const info = { index: err.constraint, fields: [err.field] };
  if (!isSourceKeyRule(info)) return err;
  const quotes = await quotationRepository.findMany(subjectWhere(source.sourceType, source.sourceId));
  return new ConflictError(describeSourceConflict(SOURCE_LABEL[source.sourceType], quotes));
}

async function nextQuotationNumber(tx: Tx): Promise<string> {
  const bucket = monthBucket('QTN');
  await lockNumberBucket(tx, bucket);
  return nextSequenceNumber(bucket, await quotationRepository.findLastNumber(bucket, tx));
}

// After a send, move the source to QUOTATION_SENT if the pipeline allows it from where it is. Never bypasses
// the state machine and never fails the send: the quotation is already sent, so a refusal is only logged.
async function tryAdvanceStage(sourceType: SourceType, sourceId: string, actorId: string | null): Promise<boolean> {
  try {
    const source = (await loadSource(sourceType, sourceId, prisma)) as { pipelineStage: PipelineStage } | null;
    if (!source || !canTransition(source.pipelineStage, 'QUOTATION_SENT')) return false;
    await leadWorkspaceService.transitionStage(sourceType, sourceId, { toStage: 'QUOTATION_SENT', actorId });
    return true;
  } catch (err) {
    console.error('quotation send: pipeline advance skipped', err);
    return false;
  }
}

export const quotationService = {
  async listForSource(sourceType: SourceType, sourceId: string): Promise<QuotationView[]> {
    await expireOverdue(subjectWhere(sourceType, sourceId));
    const rows = await quotationRepository.findMany(subjectWhere(sourceType, sourceId));
    return rows.map(toQuotationView);
  },

  async getById(id: string): Promise<QuotationView> {
    await expireOverdue({ id });
    const row = await quotationRepository.findById(id);
    if (!row) throw new NotFoundError('Quotation', id);
    return toQuotationView(row);
  },

  // ----- S1: drafts -----

  async create(sourceType: SourceType, sourceId: string, input: QuotationInput, actorId: string | null) {
    const { totals, gstEnabled } = prepare(input);

    try {
      return await prisma.$transaction(async (tx) => {
        await assertVendorsExist(input.items, tx);

        // Serialize concurrent creates for the same source; the partial unique index
        // (one open quotation per source) is the database backstop.
        await lockMany(tx, [sourceKey(sourceType, sourceId)]);
        await expireOverdue(subjectWhere(sourceType, sourceId), tx);

        const blocked = evaluateQuotable({
          sourceLabel: SOURCE_LABEL[sourceType],
          sourceType,
          sourceId,
          sourceExists: (await loadSource(sourceType, sourceId, tx)) !== null,
          wedding: await findWeddingForSource(sourceType, sourceId, tx),
          accepted: await quotationRepository.findFirst({ ...subjectWhere(sourceType, sourceId), status: 'ACCEPTED' }, tx),
          open: await quotationRepository.findFirst(
            { ...subjectWhere(sourceType, sourceId), status: { in: ['DRAFT', 'SENT'] } },
            tx
          ),
        });
        if (blocked) throw blocked;

        const created = await quotationRepository.create(
          {
            ...subjectCreateData(sourceType, sourceId),
            quotationNumber: await nextQuotationNumber(tx),
            status: 'DRAFT',
            subtotal: totals.subtotal,
            discount: totals.discount,
            gstEnabled,
            gstAmount: totals.gstAmount,
            total: totals.total,
            advanceAmount: totals.advanceAmount,
            validUntil: input.validUntil ?? null,
            terms: input.terms?.trim() || null,
            notes: input.notes?.trim() || null,
            createdBy: actorId ? { connect: { id: actorId } } : undefined,
            items: { create: itemRows(input.items) },
          },
          tx
        );
        return toQuotationView(created);
      });
    } catch (err) {
      throw await explainSourceConflict(err, { sourceType, sourceId });
    }
  },

  async update(id: string, input: QuotationInput) {
    const { totals, gstEnabled } = prepare(input);

    return prisma.$transaction(async (tx) => {
      const { q } = await loadLocked(tx, id);
      const blocked = evaluateEditable(q.status);
      if (blocked) throw blocked;

      await assertVendorsExist(input.items, tx);
      // Items are replaced wholesale — a draft has no history worth diffing.
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      const updated = await quotationRepository.update(
        id,
        {
          subtotal: totals.subtotal,
          discount: totals.discount,
          gstEnabled,
          gstAmount: totals.gstAmount,
          total: totals.total,
          advanceAmount: totals.advanceAmount,
          validUntil: input.validUntil ?? null,
          terms: input.terms?.trim() || null,
          notes: input.notes?.trim() || null,
          items: { create: itemRows(input.items) },
        },
        tx
      );
      return toQuotationView(updated);
    });
  },

  // Deleting a REVISION draft brings its predecessor back (sent again if still valid, else expired), so
  // abandoning a revision never leaves the customer with no current quotation.
  async deleteDraft(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const { q, sourceType, sourceId } = await loadLocked(tx, id);
      const blocked = evaluateDeletable(q.status);
      if (blocked) throw blocked;

      await quotationRepository.delete(id, tx);

      if (q.supersedesId) {
        const previous = await quotationRepository.findById(q.supersedesId, tx);
        if (previous && previous.status === 'SUPERSEDED') {
          const restored = statusAfterRevisionDiscarded(previous.validUntil, new Date());
          await quotationRepository.update(previous.id, { status: restored }, tx);
          await logEvent(
            tx,
            sourceType,
            sourceId,
            ActivityType.QUOTATION_REVISED,
            `Revision ${q.quotationNumber} discarded — ${previous.quotationNumber} is ${restored === 'SENT' ? 'current again' : 'expired'}`,
            null,
            null
          );
        }
      }
    });
  },

  // ----- S2: lifecycle -----

  // DRAFT → SENT. Freezes the numbers (a SENT quotation is never edited) and logs it on the source.
  async send(id: string, actorId: string | null) {
    await expireOverdue({ id });
    const sent = await prisma.$transaction(async (tx) => {
      const { q, sourceType, sourceId } = await loadLocked(tx, id);
      const now = new Date();
      const blocked = evaluateSendable({ status: q.status, itemCount: q.items.length, validUntil: q.validUntil }, now);
      if (blocked) throw blocked;

      // Integrity check: what is stored must equal a fresh calculation from the lines.
      const fresh = calculateQuotationTotals({
        items: q.items,
        discount: q.discount,
        gstAmount: q.gstAmount,
        advanceAmount: q.advanceAmount,
      });
      if (fresh.subtotal !== q.subtotal || fresh.total !== q.total) {
        throw new Error(`Quotation ${q.quotationNumber}: stored totals do not match its line items`);
      }

      const updated = await quotationRepository.update(id, { status: 'SENT', sentAt: now }, tx);
      await logEvent(
        tx,
        sourceType,
        sourceId,
        ActivityType.QUOTATION_SENT,
        `Quotation ${q.quotationNumber} sent — total ${rupees(q.total)}, advance ${rupees(q.advanceAmount)}, valid until ${formatQuoteDate(q.validUntil) ?? '—'}`,
        null,
        actorId
      );
      return { updated, sourceType, sourceId };
    });

    const stageAdvanced = await tryAdvanceStage(sent.sourceType, sent.sourceId, actorId);
    return { quotation: toQuotationView(sent.updated), stageAdvanced };
  },

  // SENT → ACCEPTED, recorded by staff on the customer's behalf (decision Q1: no customer login or link).
  async accept(id: string, input: { channel: AcceptanceChannel; note?: string | null }, actorId: string | null) {
    await expireOverdue({ id });
    return prisma.$transaction(async (tx) => {
      const { q, sourceType, sourceId } = await loadLocked(tx, id);
      const now = new Date();
      const blocked = evaluateAcceptable({ status: q.status, validUntil: q.validUntil }, now);
      if (blocked) throw blocked;

      const note = input.note?.trim() || null;
      const updated = await quotationRepository.update(
        id,
        {
          status: 'ACCEPTED',
          acceptedAt: now,
          acceptedBy: actorId ? { connect: { id: actorId } } : undefined,
          acceptedChannel: input.channel,
          acceptedNote: note,
        },
        tx
      );
      await logEvent(
        tx,
        sourceType,
        sourceId,
        ActivityType.QUOTATION_ACCEPTED,
        `Quotation ${q.quotationNumber} accepted by the customer via ${CHANNEL_LABEL[input.channel]} — total ${rupees(q.total)}`,
        note,
        actorId
      );
      return toQuotationView(updated);
    });
  },

  // SENT → REJECTED with a required reason.
  async reject(id: string, input: { reason: string }, actorId: string | null) {
    const reason = input.reason.trim();
    if (!reason) throw new ValidationError('Say why the customer declined');
    await expireOverdue({ id });
    return prisma.$transaction(async (tx) => {
      const { q, sourceType, sourceId } = await loadLocked(tx, id);
      const blocked = evaluateRejectable(q.status);
      if (blocked) throw blocked;

      const updated = await quotationRepository.update(id, { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason }, tx);
      await logEvent(tx, sourceType, sourceId, ActivityType.QUOTATION_REJECTED, `Quotation ${q.quotationNumber} rejected`, reason, actorId);
      return toQuotationView(updated);
    });
  },

  // ACCEPTED → a Booking (status NEW) whose lines and prices come from the quotation (S3). Confirming the
  // booking afterwards uses the existing PUT /api/bookings/[id] → convertBookingToWedding. The wedding date
  // must be known here so the booking can never get stuck at conversion; staff supply it when the source
  // has no clear one. One Booking per quotation: Booking.quotationId is unique, so a racing second request
  // fails cleanly at the database as well as at the check below.
  async createBooking(id: string, overrides: BookingOverrides, actorId: string | null) {
    return prisma.$transaction(async (tx) => {
      const { q, sourceType, sourceId } = await loadLocked(tx, id);
      const blocked = evaluateBookable({
        status: q.status,
        sourceType,
        sourceLabel: SOURCE_LABEL[sourceType],
        hasBooking: (await tx.booking.findFirst({ where: { quotationId: id }, select: { id: true } })) !== null,
        wedding: sourceType === 'LEAD' ? null : await findWeddingForSource(sourceType, sourceId, tx),
      });
      if (blocked) throw blocked;

      const vendorIds = [...new Set(q.items.map((i) => i.vendorId).filter((v): v is string => !!v))];
      const vendorRows = vendorIds.length
        ? await tx.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true, category: { select: { name: true } } } })
        : [];
      const plan = planBookingFromQuotation({
        quotation: q,
        source: await bookingSourceFacts(sourceType, sourceId, tx),
        vendors: new Map(vendorRows.map((v) => [v.id, { name: v.name, categoryName: v.category.name }])),
        overrides,
      });

      const booking = await bookingRepository.create(
        {
          name: plan.name,
          phone: plan.phone,
          city: plan.city,
          total: plan.total,
          status: 'NEW',
          weddingDate: plan.weddingDate,
          weddingType: plan.weddingType,
          guestCount: plan.guestCount,
          quotation: { connect: { id } },
          ...(sourceType === 'ENQUIRY' ? { enquiry: { connect: { id: sourceId } } } : { consultation: { connect: { id: sourceId } } }),
          items: { create: plan.items },
        },
        tx
      );
      await logEvent(
        tx,
        sourceType,
        sourceId,
        ActivityType.STATUS_CHANGED,
        `Booking created from quotation ${q.quotationNumber} — ${rupees(plan.total)}. Confirm it to create the wedding`,
        null,
        actorId
      );
      return booking;
    });
  },

  // SENT / REJECTED / EXPIRED → a new DRAFT (revision + 1) copied from it. A SENT original is marked
  // SUPERSEDED at once (a source can have only one open quotation); discarding the draft restores it.
  async revise(id: string, actorId: string | null) {
    try {
      await expireOverdue({ id });
      return await prisma.$transaction(async (tx) => {
        const { q, sourceType, sourceId } = await loadLocked(tx, id);
        const blocked = evaluateRevisable(q.status);
        if (blocked) throw blocked;

        const label = SOURCE_LABEL[sourceType];
        if (await tx.quotation.findFirst({ where: { supersedesId: id }, select: { id: true } })) {
          throw new ConflictError('This quotation was already revised');
        }
        const where = subjectWhere(sourceType, sourceId);
        const accepted = await quotationRepository.findFirst({ ...where, status: 'ACCEPTED' }, tx);
        if (accepted) {
          throw new ConflictError(`This ${label} already has an accepted quotation (${accepted.quotationNumber})`);
        }
        const open = await quotationRepository.findFirst({ ...where, status: { in: ['DRAFT', 'SENT'] }, id: { not: id } }, tx);
        if (open) {
          throw new ConflictError(`This ${label} already has an open quotation (${open.quotationNumber}) — finish it first`);
        }

        const quotationNumber = await nextQuotationNumber(tx);
        // Status first: the old SENT quotation must stop being "open" before the new draft is inserted.
        if (q.status === 'SENT') {
          await quotationRepository.update(id, { status: 'SUPERSEDED' }, tx);
        }
        const revision = await quotationRepository.create(
          {
            ...subjectCreateData(sourceType, sourceId),
            quotationNumber,
            revision: q.revision + 1,
            supersedes: { connect: { id } },
            status: 'DRAFT',
            subtotal: q.subtotal,
            discount: q.discount,
            gstEnabled: q.gstEnabled,
            gstAmount: q.gstAmount,
            total: q.total,
            advanceAmount: q.advanceAmount,
            validUntil: null, // a revision must be given a fresh valid-until date before it is sent
            terms: q.terms,
            notes: q.notes,
            createdBy: actorId ? { connect: { id: actorId } } : undefined,
            items: {
              create: q.items.map((item) => ({
                sortOrder: item.sortOrder,
                description: item.description,
                category: item.category,
                functionLabel: item.functionLabel,
                vendorId: item.vendorId,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
              })),
            },
          },
          tx
        );
        await logEvent(
          tx,
          sourceType,
          sourceId,
          ActivityType.QUOTATION_REVISED,
          `Quotation ${q.quotationNumber} revised — new draft ${quotationNumber} (revision ${revision.revision})`,
          null,
          actorId
        );
        return toQuotationView(revision);
      });
    } catch (err) {
      const first = err instanceof DuplicateError ? await quotationRepository.findById(id) : null;
      throw await explainSourceConflict(err, first ? sourceOf(first) : null);
    }
  },
};
