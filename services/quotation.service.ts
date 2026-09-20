import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { subjectCreateData, subjectWhere } from '@/lib/crm/subject';
import { lockNumberBucket, monthBucket, nextSequenceNumber } from '@/lib/numbering';
import { calculateQuotationTotals } from '@/lib/quotation/totals';
import { evaluateDeletable, evaluateEditable, evaluateQuotable } from '@/lib/quotation/rules';
import { quotationRepository, type QuotationWithItems } from '@/repositories/quotation.repository';
import { enquiryRepository } from '@/repositories/enquiry.repository';
import { consultationRepository } from '@/repositories/consultation.repository';
import { leadRepository } from '@/repositories/lead.repository';
import { findWeddingForSource } from '@/services/weddingConversion.service';
import type { SourceType } from '@/services/leadInbox.service';

// Quotation workflow, slice S1: create / edit / list / delete a DRAFT.
// (Send / revise / accept / reject / expire, booking link and the automatic advance
// invoice are the next slices — docs/wedding-os/08-quotation.md §13.)

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

// API shape: the stored row plus what is derived from it and must never be stored.
export function toQuotationView(q: QuotationWithItems) {
  return {
    ...q,
    balance: q.total - q.advanceAmount,
    items: q.items.map((item) => ({ ...item, lineTotal: item.unitPrice * item.quantity })),
  };
}
export type QuotationView = ReturnType<typeof toQuotationView>;

// Transaction-scoped advisory lock, same mechanism as weddingConversion's — serializes
// concurrent writers for one key; released automatically at commit/rollback.
async function lock(tx: Tx, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

async function loadSource(sourceType: SourceType, id: string, tx: Tx): Promise<unknown | null> {
  if (sourceType === 'ENQUIRY') return enquiryRepository.findById(id, tx);
  if (sourceType === 'CONSULTATION') return consultationRepository.findById(id, tx);
  return leadRepository.findById(id, tx);
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

export const quotationService = {
  async listForSource(sourceType: SourceType, sourceId: string): Promise<QuotationView[]> {
    const rows = await quotationRepository.findMany(subjectWhere(sourceType, sourceId));
    return rows.map(toQuotationView);
  },

  async getById(id: string): Promise<QuotationView> {
    const row = await quotationRepository.findById(id);
    if (!row) throw new NotFoundError('Quotation', id);
    return toQuotationView(row);
  },

  async create(sourceType: SourceType, sourceId: string, input: QuotationInput, actorId: string | null) {
    const { totals, gstEnabled } = prepare(input);

    return prisma.$transaction(async (tx) => {
      await assertVendorsExist(input.items, tx);

      // Serialize concurrent creates for the same source; the partial unique index
      // (one open quotation per source) is the database backstop.
      await lock(tx, `QUOTATION:${sourceType}:${sourceId}`);

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

      const bucket = monthBucket('QTN');
      await lockNumberBucket(tx, bucket);
      const quotationNumber = nextSequenceNumber(bucket, await quotationRepository.findLastNumber(bucket, tx));

      const created = await quotationRepository.create(
        {
          ...subjectCreateData(sourceType, sourceId),
          quotationNumber,
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
  },

  async update(id: string, input: QuotationInput) {
    const { totals, gstEnabled } = prepare(input);

    return prisma.$transaction(async (tx) => {
      await lock(tx, `QUOTATION:${id}`);
      const existing = await quotationRepository.findById(id, tx);
      if (!existing) throw new NotFoundError('Quotation', id);
      const blocked = evaluateEditable(existing.status);
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

  async deleteDraft(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await lock(tx, `QUOTATION:${id}`);
      const existing = await quotationRepository.findById(id, tx);
      if (!existing) throw new NotFoundError('Quotation', id);
      const blocked = evaluateDeletable(existing.status);
      if (blocked) throw blocked;
      await quotationRepository.delete(id, tx);
    });
  },
};
