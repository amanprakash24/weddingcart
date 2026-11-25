import type { Prisma } from '@/generated/prisma/client';
import { ActivityType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { auditAs } from '@/lib/finance/audit';
import { CONFIRMATION_CHANNELS, planConfirmation, type ConfirmationLine } from '@/lib/commercial/confirmation';
import type { AgreementItem } from '@/lib/commercial/agreement';
import type { AgreementMoneyView } from '@/lib/commercial/view';
import { planAdvanceInvoice } from '@/lib/quotation/advanceInvoice';
import { currentBusiness, rulesOf } from '@/lib/ownership/business';
import { invoiceRepository } from '@/repositories/invoice.repository';
import { generateConfirmationNumber, generateInvoiceNumber } from '@/services/documentNumber.service';
import { loadAgreementMoney, logMoney, recordAgreementPayment, type RecordAgreementPaymentInput } from '@/services/agreement.service';

// Confirming chosen services of a sent quotation (money design v1, PR 8a, 26 Nov 2026).
//
//   Sent quotation → staff confirm the services the couple agreed to (CNF-…, frozen lines) → its own agreement (25% rule) and its own
//   advance invoice → payments against that confirmation → its balance invoice when money goes past the 25%.
//
// The rest of the quotation stays SENT and can be confirmed later. A quotation is either booked as a whole (its one agreement with no
// confirmation, the flow every booking used before) or service by service — never both (refused here and in agreement.service.ts).
// The wedding is created from / joined by a confirmation in PR 8b; until then a confirmation lives on the lead.

type Tx = Prisma.TransactionClient;
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export interface ConfirmationView {
  id: string;
  number: string;
  status: 'CONFIRMED' | 'CANCELLED';
  channel: string;
  confirmedAt: string;
  total: number;
  advance: number;
  lines: { quotationItemId: string; description: string; functionLabel: string | null; quantity: number; unitPrice: number; total: number }[];
  money: AgreementMoneyView;
}

async function customerOf(tx: Tx, q: { leadId: string | null; enquiryId: string | null; consultationId: string | null }) {
  const select = { name: true, phone: true } as const;
  const s = q.leadId
    ? await tx.lead.findUnique({ where: { id: q.leadId }, select: { phone: true } }).then((l) => (l ? { name: l.phone, phone: l.phone } : null)) // a website lead has only a phone
    : q.enquiryId
      ? await tx.enquiry.findUnique({ where: { id: q.enquiryId }, select })
      : q.consultationId
        ? await tx.consultation.findUnique({ where: { id: q.consultationId }, select })
        : null;
  if (!s) throw new NotFoundError('Customer', q.leadId ?? q.enquiryId ?? q.consultationId ?? '');
  return s;
}

const agreementItems = (lines: ConfirmationLine[]): AgreementItem[] =>
  lines.map((l) => ({ itemId: l.quotationItemId, name: l.description, description: l.description, category: l.category, vendorId: l.vendorId, quantity: l.quantity, unitPrice: l.unitPrice, total: l.amount, functionLabel: l.functionLabel }));

export const confirmationService = {
  // Staff confirm the chosen services. One transaction: confirmation + frozen lines + agreement + advance invoice, or nothing.
  async confirm(quotationId: string, input: { itemIds: unknown; channel: unknown }, actorId: string | null) {
    const itemIds = Array.isArray(input.itemIds) ? input.itemIds.filter((x): x is string => typeof x === 'string') : [];
    const channel = CONFIRMATION_CHANNELS.find((c) => c.id === input.channel);
    if (!channel) throw new ValidationError('Say how the couple confirmed (in person, on a call, on WhatsApp)');
    const rules = rulesOf(await currentBusiness());
    return prisma.$transaction(async (tx) => {
      await auditAs(tx, actorId, `services confirmed (${channel.label.toLowerCase()})`);
      await tx.$queryRaw`SELECT "id" FROM "quotations" WHERE "id" = ${quotationId} FOR UPDATE`; // two confirmations at once are taken in turn
      const quotation = await tx.quotation.findUnique({ where: { id: quotationId }, include: { items: { orderBy: { sortOrder: 'asc' } } } });
      if (!quotation) throw new NotFoundError('Quotation', quotationId);
      if (quotation.advanceInvoiceId || (await tx.commercialAgreement.count({ where: { quotationId, confirmationId: null } })) > 0) {
        throw new ConflictError(`Quotation ${quotation.quotationNumber} is being booked as a whole — services cannot be confirmed separately`);
      }
      const live = await tx.confirmation.findMany({ where: { quotationId, status: 'CONFIRMED' }, select: { total: true, lines: { where: { live: true }, select: { quotationItemId: true } } } });
      const plan = planConfirmation({
        quotation: { ...quotation, items: quotation.items.map((i) => ({ ...i, gstRateBp: i.gstRateBp ?? null })) },
        chosenItemIds: itemIds,
        confirmed: { itemIds: live.flatMap((c) => c.lines.map((l) => l.quotationItemId)), total: live.reduce((s, c) => s + c.total, 0) },
        rules,
      });
      if (!plan.ok) throw new ValidationError(plan.error);
      const p = plan.value;
      const customer = await customerOf(tx, quotation);

      const confirmation = await tx.confirmation.create({
        data: {
          number: await generateConfirmationNumber(tx),
          quotation: { connect: { id: quotationId } },
          quotationRevision: quotation.revision,
          channel: channel.id,
          confirmedById: actorId,
          subtotal: p.subtotal,
          discount: p.discount,
          taxable: p.taxable,
          gst: p.gst,
          total: p.total,
          confirmationPercent: p.confirmationPercent,
          advance: p.advance,
          lines: { create: p.lines.map((l, i) => ({ ...l, sortOrder: i + 1 })) },
        },
      });

      const items = agreementItems(p.lines);
      await tx.commercialAgreement.create({
        data: {
          quotation: { connect: { id: quotationId } },
          confirmation: { connect: { id: confirmation.id } },
          quotationRevision: quotation.revision,
          customerName: customer.name,
          customerPhone: customer.phone,
          currency: 'INR',
          subtotal: p.subtotal,
          discountAmount: p.discount,
          taxAmount: p.gst,
          agreementTotal: p.total,
          confirmationPercent: p.confirmationPercent,
          confirmationAmount: p.advance,
          confirmationRounding: rules.rounding,
          holdWindowDays: rules.holdWindowDays,
          termsSnapshot: quotation.terms,
          itemsSnapshot: items as unknown as Prisma.InputJsonValue,
          functionLabels: [...new Set(items.map((i) => i.functionLabel).filter((l): l is string => Boolean(l)))] as unknown as Prisma.InputJsonValue,
          acceptedAt: confirmation.confirmedAt,
          acceptedById: actorId,
        },
      });

      // The advance invoice is for the confirmation's 25%, with its share of the GST — the quotation's own advance invoice is untouched.
      const advancePlan = planAdvanceInvoice({
        quotation: { quotationNumber: `${quotation.quotationNumber} · ${confirmation.number}`, total: p.total, advanceAmount: p.advance, gstAmount: p.gst, sellerGstin: quotation.sellerGstin },
        wedding: { primaryDate: null, weddingType: null },
        client: { name: customer.name, phone: customer.phone },
        confirmationAmount: p.advance,
      });
      const invoice = await invoiceRepository.create(
        {
          invoiceNumber: await generateInvoiceNumber(tx),
          ...advancePlan.invoice,
          status: 'DRAFT',
          kind: 'ADVANCE',
          quotation: { connect: { id: quotationId } },
          confirmation: { connect: { id: confirmation.id } },
          items: { create: advancePlan.items },
        },
        tx
      );
      await logMoney(
        tx,
        quotation,
        null,
        `${confirmation.number}: ${p.lines.map((l) => l.description).join(', ')} confirmed ${channel.label.toLowerCase()} — ${inr(p.total)}; invoice ${invoice.invoiceNumber} for the ${inr(p.advance)} (${p.confirmationPercent}%) that confirms it${p.isLast ? '' : '. The other services stay on the quotation'}`,
        ActivityType.STATUS_CHANGED,
        actorId
      );
      return { confirmation, advanceInvoiceId: invoice.id, isLast: p.isLast };
    });
  },

  // Every confirmation of a quotation, with its own money card.
  async forQuotation(quotationId: string): Promise<ConfirmationView[]> {
    const rows = await prisma.confirmation.findMany({ where: { quotationId }, orderBy: { confirmedAt: 'asc' }, include: { lines: { orderBy: { sortOrder: 'asc' } } } });
    return Promise.all(
      rows.map(async (c) => ({
        id: c.id,
        number: c.number,
        status: c.status,
        channel: c.channel,
        confirmedAt: c.confirmedAt.toISOString(),
        total: c.total,
        advance: c.advance,
        lines: c.lines.map((l) => ({ quotationItemId: l.quotationItemId, description: l.description, functionLabel: l.functionLabel, quantity: l.quantity, unitPrice: l.unitPrice, total: l.total })),
        money: await loadAgreementMoney({ quotationId, confirmationId: c.id }),
      }))
    );
  },

  // Money received for one confirmation (cash / UPI / bank / cheque): its advance first, then its balance.
  async recordPayment(quotationId: string, confirmationId: string, input: RecordAgreementPaymentInput, actorId: string | null) {
    const c = await prisma.confirmation.findFirst({ where: { id: confirmationId, quotationId }, select: { status: true } });
    if (!c) throw new NotFoundError('Confirmation', confirmationId);
    if (c.status !== 'CONFIRMED') throw new ConflictError('This confirmation is cancelled');
    return recordAgreementPayment({ quotationId, confirmationId }, input, actorId);
  },
};
