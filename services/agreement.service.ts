import { auditAs } from '@/lib/finance/audit';
import { randomUUID } from 'node:crypto';
import type { Booking, Prisma, CommercialAgreement } from '@/generated/prisma/client';
import { ActivityType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { subjectCreateData } from '@/lib/crm/subject';
import { buildAgreementSnapshot, planPaymentSplit } from '@/lib/commercial/agreement';
import { confirmationRefusal, confirmationStatus, holdExpiry } from '@/lib/commercial/rules';
import { buildAgreementMoney, type AgreementMoneyView } from '@/lib/commercial/view';
import { MANUAL_PAYMENT_METHODS, planBalanceInvoice, type ManualPaymentMethod } from '@/lib/invoice/lifecycle';
import { planAdvanceInvoice } from '@/lib/quotation/advanceInvoice';
import { resolveUserNames } from '@/lib/users';
import { activityLogRepository } from '@/repositories/activityLog.repository';
import { invoiceRepository } from '@/repositories/invoice.repository';
import { quotationRepository } from '@/repositories/quotation.repository';
import { generateInvoiceNumber } from '@/services/documentNumber.service';
import { settleInvoiceStatus } from '@/services/invoiceWorkflow.service';
import type { SourceType } from '@/services/leadInbox.service';
import { currentBusiness, rulesOf } from '@/lib/ownership/business';

// Money v1 — the 25% confirmation rule (docs/wedding-os/10-commercial-flow-v1.md, 22 Sep 2026).
//
//   Accepted quotation → booking created (agreement frozen, advance invoice = the 25%) → payments → 25% received → booking confirmed
//   → wedding created (the same invoices attach to it).
//
// The accepted quotation stays THE commercial source; the CommercialAgreement is the booking-time snapshot; invoices and payments are
// the financial execution (the PR #118 records — no second architecture). Nothing that moves is stored on the agreement: what was
// received is always summed from Payment rows, and Date Held / Confirmed are derived from that.

type Tx = Prisma.TransactionClient;

// Which agreement (money design v1, PR 8). A plain quotation id is the quotation's whole-quotation agreement — every agreement made
// before 25 Nov 2026 and every whole-quotation booking since; it has no confirmation. { quotationId, confirmationId } is the agreement
// of one confirmation of chosen services. Its invoices carry the same confirmationId, so each agreement only ever sees its own money.
export type AgreementKey = string | { quotationId: string; confirmationId: string | null };
export interface AgreementRef { quotationId: string; confirmationId: string | null }
export const refOf = (key: AgreementKey): AgreementRef => (typeof key === 'string' ? { quotationId: key, confirmationId: null } : key);
// The invoices (advance and balance) of one agreement
export const agreementInvoicesWhere = (ref: AgreementRef) => ({ quotationId: ref.quotationId, confirmationId: ref.confirmationId, kind: { in: ['ADVANCE' as const, 'BALANCE' as const] } });
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const METHOD_LABEL: Record<ManualPaymentMethod, string> = { CASH: 'cash', UPI: 'UPI', BANK_TRANSFER: 'bank transfer', CHEQUE: 'cheque' };

function sourceOf(q: { leadId: string | null; enquiryId: string | null; consultationId: string | null }): { sourceType: SourceType; sourceId: string } {
  if (q.leadId) return { sourceType: 'LEAD', sourceId: q.leadId };
  if (q.enquiryId) return { sourceType: 'ENQUIRY', sourceId: q.enquiryId };
  return { sourceType: 'CONSULTATION', sourceId: q.consultationId as string };
}

async function lockQuotation(tx: Tx, quotationId: string) {
  await tx.$queryRaw`SELECT "id" FROM "quotations" WHERE "id" = ${quotationId} FOR UPDATE`;
}

// Who the agreement (and its invoices) are for: the booking's customer, else the lead / enquiry / consultation the quotation is for.
async function customerFor(tx: Tx, q: { leadId: string | null; enquiryId: string | null; consultationId: string | null }, booking: Booking | null) {
  if (booking) return { name: booking.name, phone: booking.phone, city: booking.city, customerId: booking.customerId };
  const { sourceType, sourceId } = sourceOf(q);
  const select = { name: true, phone: true } as const;
  // A website lead has only a phone number (no name column): it stands as the name, as on the lead page (fix found 26 Nov 2026 —
  // selecting a lead's "name" threw, so a lead's quotation could not be paid against before a booking existed).
  const subject =
    sourceType === 'LEAD'
      ? await tx.lead.findUnique({ where: { id: sourceId }, select: { phone: true } }).then((l) => (l ? { name: l.phone, phone: l.phone } : null))
      : sourceType === 'ENQUIRY' ? await tx.enquiry.findUnique({ where: { id: sourceId }, select }) : await tx.consultation.findUnique({ where: { id: sourceId }, select });
  if (!subject) throw new NotFoundError(sourceType, sourceId);
  return { name: subject.name, phone: subject.phone, city: null as string | null, customerId: null as string | null };
}

export async function logMoney(tx: Tx, q: { leadId: string | null; enquiryId: string | null; consultationId: string | null }, weddingId: string | null, summary: string, type: ActivityType, actorId: string | null) {
  await activityLogRepository.create(
    {
      type,
      summary,
      performedBy: actorId ? { connect: { id: actorId } } : undefined,
      // Once the wedding exists the money story belongs to it; before that it belongs to the lead the quotation is for.
      ...(weddingId ? { wedding: { connect: { id: weddingId } } } : subjectCreateData(sourceOf(q).sourceType, sourceOf(q).sourceId)),
    },
    tx
  );
}

// Creates the agreement of an ACCEPTED quotation — and its advance invoice, for exactly the confirmation amount — if it does not
// exist yet. Idempotent: called when the booking is created, and lazily when a CRM quotation (no booking) is first paid against or
// first asked to confirm. Returns null for a quotation that already went through the old flow (its advance invoice was made at
// conversion): historical records are never silently changed.
export async function ensureAgreementInTx(
  tx: Tx,
  input: { quotationId: string; booking?: Booking | null; actorId: string | null }
): Promise<CommercialAgreement | null> {
  const { quotationId, actorId } = input;
  await lockQuotation(tx, quotationId);
  const existing = await tx.commercialAgreement.findFirst({ where: { confirmationId: null, quotationId } });
  if (existing) {
    // A booking made later (or a retry) is attached to the agreement, and the booking's own id goes on its invoices.
    if (input.booking && !existing.bookingId) {
      await tx.commercialAgreement.update({ where: { id: existing.id }, data: { bookingId: input.booking.id } });
      await tx.invoice.updateMany({ where: { quotationId, confirmationId: null, bookingId: null }, data: { bookingId: input.booking.id } });
      return { ...existing, bookingId: input.booking.id };
    }
    return existing;
  }

  const quotation = await quotationRepository.findById(quotationId, tx);
  if (!quotation) throw new NotFoundError('Quotation', quotationId);
  if (quotation.status !== 'ACCEPTED') throw new ConflictError(`Quotation ${quotation.quotationNumber} is ${quotation.status.toLowerCase()} — only an accepted quotation has an agreement`);
  if (quotation.advanceInvoiceId) return null; // made under the old flow (at conversion) — leave it exactly as it was
  // PR 8: a quotation whose services are confirmed one by one has an agreement per confirmation — never a whole-quotation one too
  const confirmed = await tx.confirmation.count({ where: { quotationId, status: 'CONFIRMED' } });
  if (confirmed > 0) throw new ConflictError(`Some services of quotation ${quotation.quotationNumber} are confirmed separately — record money against those confirmations`);

  const booking = input.booking ?? (await tx.booking.findFirst({ where: { quotationId } }));
  const customer = await customerFor(tx, quotation, booking);
  // Frozen with the rule of the business that owns the quotation (a venue may set its own; the platform's is 25% / 7 days).
  const snapshot = buildAgreementSnapshot({ quotation, customer, bookingId: booking?.id ?? null, rules: rulesOf(await currentBusiness()) });
  const agreement = await tx.commercialAgreement.create({
    data: { ...snapshot, itemsSnapshot: snapshot.itemsSnapshot as unknown as Prisma.InputJsonValue, functionLabels: snapshot.functionLabels as unknown as Prisma.InputJsonValue },
  });

  const plan = planAdvanceInvoice({
    quotation,
    wedding: { primaryDate: booking?.weddingDate ?? null, weddingType: booking?.weddingType ?? null },
    client: { name: customer.name, phone: customer.phone, city: customer.city },
    confirmationAmount: agreement.confirmationAmount,
  });
  const invoice = await invoiceRepository.create(
    {
      invoiceNumber: await generateInvoiceNumber(tx),
      ...plan.invoice,
      status: 'DRAFT',
      kind: 'ADVANCE',
      quotation: { connect: { id: quotation.id } },
      booking: booking ? { connect: { id: booking.id } } : undefined,
      customerId: customer.customerId ?? undefined,
      items: { create: plan.items },
    },
    tx
  );
  await quotationRepository.update(quotation.id, { advanceInvoice: { connect: { id: invoice.id } } }, tx);
  await logMoney(
    tx,
    quotation,
    null,
    `Booking confirmation invoice ${invoice.invoiceNumber} created from quotation ${quotation.quotationNumber} — ${inr(agreement.confirmationAmount)} (${agreement.confirmationPercent}% of ${inr(agreement.agreementTotal)}) is needed to confirm the booking`,
    ActivityType.INVOICE_CREATED,
    actorId
  );
  return agreement;
}

async function receivedFor(tx: Tx | typeof prisma, key: AgreementKey): Promise<number> {
  const payments = await tx.payment.findMany({ where: { status: 'SUCCESS', invoice: agreementInvoicesWhere(refOf(key)) }, select: { amount: true } });
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

// ---------- reading ----------

// The Money card for a quotation's agreement, before or after the wedding exists. With no agreement yet it previews what would be
// required from the accepted total.
export async function loadAgreementMoney(key: AgreementKey, now: Date = new Date()): Promise<AgreementMoneyView> {
  const ref = refOf(key);
  const { quotationId } = ref;
  const quotation = await prisma.quotation.findUnique({ where: { id: quotationId }, select: { id: true, quotationNumber: true, total: true, status: true } });
  if (!quotation) throw new NotFoundError('Quotation', quotationId);
  const agreement = await prisma.commercialAgreement.findFirst({ where: { quotationId, confirmationId: ref.confirmationId } });
  // a confirmation's agreement is always made with it, so its preview total is its own; the whole quotation's is the quotation's
  const confirmation = ref.confirmationId ? await prisma.confirmation.findUnique({ where: { id: ref.confirmationId }, select: { total: true, number: true } }) : null;
  const invoices = await prisma.invoice.findMany({ where: agreementInvoicesWhere(ref), include: { payments: { orderBy: { paidAt: 'asc' } } }, orderBy: { createdAt: 'asc' } });
  const names = await resolveUserNames(invoices.flatMap((i) => i.payments.map((p) => p.recordedById)));
  const booking = agreement?.bookingId ? await prisma.booking.findUnique({ where: { id: agreement.bookingId }, select: { id: true, status: true } }) : ref.confirmationId ? null : await prisma.booking.findFirst({ where: { quotationId }, select: { id: true, status: true } });
  const weddingId = invoices.find((i) => i.weddingId)?.weddingId ?? null;
  const bookingConfirmed = weddingId !== null || agreement?.confirmedAt != null || booking?.status === 'CONFIRMED';
  return buildAgreementMoney({
    quotationId,
    quotationNumber: quotation.quotationNumber,
    agreement: agreement ? { ...agreement, bookingId: agreement.bookingId ?? booking?.id ?? null } : null,
    previewTotal: confirmation?.total ?? quotation.total,
    invoices: invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      kind: i.kind,
      status: i.status,
      total: i.total,
      subtotal: i.subtotal,
      gstAmount: i.gstEnabled ? i.gstAmount : 0,
      sellerGstin: i.sellerGstin,
      creditedAmount: i.creditedAmount,
      payments: i.payments.map((p) => ({ id: p.id, amount: p.amount, method: p.method, status: p.status, paidAt: p.paidAt, reference: p.reference, recordedByName: p.recordedById ? (names.get(p.recordedById) ?? null) : null, receiptId: p.receiptId })),
    })),
    bookingConfirmed,
    weddingId,
    now,
  });
}

// The first payment starts the hold window; it never restarts. Used by every way money can arrive (recorded by staff, or a Razorpay
// webhook), so the window means the same thing whichever it was.
export async function startHoldIfNeeded(tx: Tx, key: AgreementKey, paidAt: Date): Promise<void> {
  const ref = refOf(key);
  const agreement = await tx.commercialAgreement.findFirst({ where: { quotationId: ref.quotationId, confirmationId: ref.confirmationId }, select: { id: true, holdStartedAt: true, holdWindowDays: true } });
  if (!agreement || agreement.holdStartedAt) return;
  await tx.commercialAgreement.update({ where: { id: agreement.id }, data: { holdStartedAt: paidAt, holdExpiresAt: holdExpiry(paidAt, agreement.holdWindowDays) } });
}

// ---------- recording a payment ----------

export interface RecordAgreementPaymentInput {
  amount: number;
  method: ManualPaymentMethod;
  reference?: string | null;
  paidAt?: Date | null;
  idempotencyKey?: string | null;
}

// Cash / UPI / bank transfer / cheque received for an accepted quotation. Applied to the advance (confirmation) invoice first and the
// rest to the balance invoice, so a customer may pay MORE than the 25% (it is a minimum, not a maximum) and every invoice's own
// arithmetic stays true. Serialised on the agreement, so two people recording at once can never together exceed what is owed. The first
// payment starts the hold window. Recording it never confirms anything by itself — see commercialFlow.service.ts.
export async function recordAgreementPayment(which: AgreementKey, input: RecordAgreementPaymentInput, actorId: string | null) {
  const ref = refOf(which);
  const { quotationId } = ref;
  if (!(MANUAL_PAYMENT_METHODS as readonly string[]).includes(input.method)) throw new ValidationError('Choose how the payment was received');
  const reference = input.reference?.trim() || null;
  const key = input.idempotencyKey?.trim() || null;

  return prisma.$transaction(async (tx) => {
    await auditAs(tx, actorId); // finance audit: who is acting (lib/finance/audit.ts)
    // A confirmation's agreement is made with the confirmation; the whole quotation's is made here if it does not exist yet.
    const agreement = ref.confirmationId
      ? await tx.commercialAgreement.findFirst({ where: { quotationId, confirmationId: ref.confirmationId } })
      : await ensureAgreementInTx(tx, { quotationId, actorId });
    if (!agreement) throw new ConflictError(ref.confirmationId ? 'This confirmation has no agreement' : 'This agreement was made before the 25% rule — record the payment on its invoice instead');
    await tx.$queryRaw`SELECT "id" FROM "commercial_agreements" WHERE "id" = ${agreement.id} FOR UPDATE`;

    // A form submitted twice (double-click, retry) is recorded once.
    if (key) {
      const prior = await tx.payment.findFirst({ where: { idempotencyKey: { startsWith: `${key}#` } }, select: { receiptId: true } });
      if (prior) return { receiptId: prior.receiptId as string, duplicate: true, splits: [] as { invoiceNumber: string; amount: number }[] };
    }

    const invoices = await tx.invoice.findMany({ where: agreementInvoicesWhere(ref), include: { payments: true } });
    const paidOn = (inv?: (typeof invoices)[number]) => (inv ? inv.payments.filter((p) => p.status === 'SUCCESS').reduce((s, p) => s + p.amount, 0) : 0);
    const advance = invoices.find((i) => i.kind === 'ADVANCE');
    let balance = invoices.find((i) => i.kind === 'BALANCE');

    const plan = planPaymentSplit({ amount: input.amount, agreementTotal: agreement.agreementTotal, confirmationAmount: agreement.confirmationAmount, advancePaid: paidOn(advance), balancePaid: paidOn(balance), advanceCredited: advance?.creditedAmount ?? 0, balanceCredited: balance?.creditedAmount ?? 0 });
    if (!plan.ok) throw new ValidationError(plan.error);

    if (reference) {
      const clash = await tx.payment.findFirst({ where: { reference: { equals: reference, mode: 'insensitive' }, invoice: { quotationId } }, select: { id: true } });
      if (clash) throw new ValidationError(`The reference “${reference}” was already recorded for this agreement`);
    }

    const quotation = await quotationRepository.findById(quotationId, tx);
    if (!quotation) throw new NotFoundError('Quotation', quotationId);
    const booking = agreement.bookingId ? await tx.booking.findUnique({ where: { id: agreement.bookingId } }) : null;
    const wedding = advance?.weddingId ? await tx.wedding.findUnique({ where: { id: advance.weddingId } }) : null;

    // The rest of the payment needs the balance invoice: it is created here, from the agreement, if it does not exist yet.
    if (plan.splits.some((s) => s.target === 'BALANCE') && !balance) {
      const forConfirmation = ref.confirmationId ? await tx.confirmation.findUnique({ where: { id: ref.confirmationId }, select: { number: true, total: true, gst: true } }) : null;
      const balancePlan = planBalanceInvoice({
        // a confirmation is billed like a quotation of its own services: its total and its GST
        quotation: forConfirmation ? { ...quotation, quotationNumber: `${quotation.quotationNumber} · ${forConfirmation.number}`, total: forConfirmation.total, gstAmount: forConfirmation.gst } : quotation,
        wedding: { primaryDate: wedding?.primaryDate ?? booking?.weddingDate ?? null, weddingType: wedding?.weddingType ?? booking?.weddingType ?? null },
        client: { name: agreement.customerName, phone: agreement.customerPhone },
        advance: agreement.confirmationAmount,
      });
      const created = await invoiceRepository.create(
        {
          invoiceNumber: await generateInvoiceNumber(tx),
          ...balancePlan.invoice,
          status: 'DRAFT',
          kind: 'BALANCE',
          quotation: { connect: { id: quotationId } },
          ...(ref.confirmationId ? { confirmation: { connect: { id: ref.confirmationId } } } : {}),
          booking: agreement.bookingId ? { connect: { id: agreement.bookingId } } : undefined,
          wedding: wedding ? { connect: { id: wedding.id } } : undefined,
          items: { create: balancePlan.items },
        },
        tx
      );
      balance = { ...created, payments: [] };
    }

    const paidAt = input.paidAt ?? new Date();
    const receiptId = randomUUID();
    const applied: { invoiceNumber: string; amount: number }[] = [];
    let index = 0;
    for (const split of plan.splits) {
      const invoice = split.target === 'ADVANCE' ? advance : balance;
      if (!invoice) throw new NotFoundError('Invoice', split.target);
      index += 1;
      await tx.payment.create({
        data: { invoiceId: invoice.id, amount: split.amount, method: input.method, status: 'SUCCESS', paidAt, reference, recordedById: actorId, receiptId, idempotencyKey: key ? `${key}#${index}` : null },
      });
      await settleInvoiceStatus(tx, invoice.id, { issue: true });
      applied.push({ invoiceNumber: invoice.invoiceNumber, amount: split.amount });
    }

    await startHoldIfNeeded(tx, ref, paidAt);

    const received = await receivedFor(tx, ref);
    const status = confirmationStatus({ required: agreement.confirmationAmount, received, holdStartedAt: agreement.holdStartedAt ?? paidAt, holdWindowDays: agreement.holdWindowDays });
    await logMoney(
      tx,
      quotation,
      wedding?.id ?? null,
      `Payment recorded: ${inr(input.amount)} by ${METHOD_LABEL[input.method]}${reference ? ` (ref ${reference})` : ''} — ${status.state === 'CONFIRMED' ? `${inr(received)} received, the ${inr(agreement.confirmationAmount)} needed to confirm the booking is in` : `${inr(status.remaining)} more required to confirm the booking`}`,
      ActivityType.PAYMENT_RECEIVED,
      actorId
    );
    return { receiptId, duplicate: false, splits: applied };
  });
}

// ---------- the confirmation gate ----------

// Booking / conversion may go ahead only when the agreement's confirmation amount has been received. The server is the source of
// truth — never a checkbox. Returns quietly for anything outside the rule (a marketplace booking with no quotation, a booking made
// under the old flow); throws a business error saying how much more is required otherwise.
export async function assertQuotationMayConfirm(quotationId: string, booking?: Booking | null): Promise<void> {
  // The agreement is created (and committed) first, so a refusal below never rolls it back.
  const agreement = await prisma.$transaction((tx) => ensureAgreementInTx(tx, { quotationId, booking: booking ?? null, actorId: null }));
  if (!agreement) return;
  const received = await receivedFor(prisma, quotationId);
  const status = confirmationStatus({ required: agreement.confirmationAmount, received, holdStartedAt: agreement.holdStartedAt, holdWindowDays: agreement.holdWindowDays });
  if (status.state !== 'CONFIRMED') throw new ConflictError(confirmationRefusal(status));
}

export async function assertBookingMayConfirm(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || !booking.quotationId) return; // a marketplace booking has no accepted quotation, so no agreement
  if (booking.status === 'CONFIRMED') return; // already confirmed — the confirm button is also the retry for a failed conversion
  await assertQuotationMayConfirm(booking.quotationId, booking);
}

// The conversion itself re-checks, inside its own transaction and without creating anything: nothing but a satisfied agreement (or one
// made under the old flow) may become a wedding.
export async function assertAgreementSatisfiedInTx(tx: Tx, quotationId: string): Promise<void> {
  const agreement = await tx.commercialAgreement.findFirst({ where: { confirmationId: null, quotationId } });
  if (!agreement) return;
  const received = await receivedFor(tx, quotationId);
  const status = confirmationStatus({ required: agreement.confirmationAmount, received, holdStartedAt: agreement.holdStartedAt, holdWindowDays: agreement.holdWindowDays });
  if (status.state !== 'CONFIRMED') throw new ConflictError(confirmationRefusal(status));
}

// When the wedding is created, the agreement's invoices (already carrying every payment) belong to it — no second invoice, no copied
// payments. Idempotent.
export async function attachAgreementToWedding(tx: Tx, quotationId: string | null | undefined, wedding: { id: string; customerId: string | null }, actorId: string | null): Promise<boolean> {
  if (!quotationId) return false;
  const agreement = await tx.commercialAgreement.findFirst({ where: { confirmationId: null, quotationId } });
  if (!agreement) return false;
  await tx.invoice.updateMany({ where: { quotationId, weddingId: null }, data: { weddingId: wedding.id, ...(wedding.customerId ? { customerId: wedding.customerId } : {}) } });
  if (!agreement.confirmedAt) {
    await tx.commercialAgreement.update({ where: { id: agreement.id }, data: { confirmedAt: new Date() } });
    const received = await receivedFor(tx, quotationId);
    await activityLogRepository.create(
      {
        type: ActivityType.STATUS_CHANGED,
        summary: `Booking confirmed — ${inr(received)} received of the ${inr(agreement.confirmationAmount)} (${agreement.confirmationPercent}% of ${inr(agreement.agreementTotal)}) required`,
        wedding: { connect: { id: wedding.id } },
        performedBy: actorId ? { connect: { id: actorId } } : undefined,
      },
      tx
    );
  }
  return true;
}

