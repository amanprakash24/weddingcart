// What the Money card shows for an agreement, worked out from the frozen agreement and the payments actually received. Pure — the same
// builder feeds the CRM lead workspace (before the wedding exists) and the wedding's Money tab (after), so the two never disagree.
//
// Nothing here is stored: received / remaining / Date Held / Confirmed are all derived (lib/commercial/rules.ts), which keeps one
// source of truth — the Payment rows.
import { COMMERCIAL_RULES, confirmationStatus, requiredConfirmation, type ConfirmationState } from './rules';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export interface AgreementMoneyInvoice {
  id: string;
  invoiceNumber: string;
  kind: 'ADVANCE' | 'BALANCE' | 'OTHER';
  status: string;
  total: number;
  payments: { id: string; amount: number; method: string; status: string; paidAt: Date | string; reference?: string | null; recordedByName?: string | null; receiptId?: string | null }[];
}

export type MoneyNext =
  | { kind: 'RECORD_PAYMENT'; label: string; invoiceId: string | null; invoiceNumber: string | null }
  | { kind: 'CONFIRM_BOOKING'; label: string; invoiceId: null; invoiceNumber: null }
  | { kind: 'COLLECT_BALANCE'; label: string; invoiceId: string | null; invoiceNumber: string | null }
  | { kind: 'DONE'; label: string; invoiceId: null; invoiceNumber: null };

export interface AgreementMoneyView {
  exists: boolean; // false = the agreement has not been created yet (a CRM quotation nobody has paid against): the figures are a preview
  quotationId: string;
  quotationNumber: string | null;
  bookingId: string | null;
  weddingId: string | null;
  agreementTotal: number;
  confirmationPercent: number;
  confirmationAmount: number;
  holdWindowDays: number;
  received: number;
  outstanding: number; // the whole agreement still to be received (not just what is invoiced)
  state: ConfirmationState;
  remaining: number; // still to receive to confirm the booking
  daysLeft: number | null;
  overdue: boolean;
  holdStartedAt: string | null;
  holdExpiresAt: string | null;
  bookingConfirmed: boolean; // the booking really was confirmed (a wedding exists / status CONFIRMED)
  readyToConfirm: boolean; // enough is received, the booking has not been confirmed yet
  message: string;
  stateLabel: string; // "Date held — 5 of 7 days left", "Booking confirmed", …
  invoices: { id: string; invoiceNumber: string; kind: 'ADVANCE' | 'BALANCE' | 'OTHER'; status: string; total: number; paid: number; outstanding: number }[];
  payments: { id: string; invoiceNumber: string; kind: string; amount: number; method: string; reference: string | null; paidAt: string; recordedByName: string | null; receiptId: string | null }[];
  next: MoneyNext;
}

const iso = (d: Date | string | null | undefined) => (d ? (d instanceof Date ? d : new Date(d)).toISOString() : null);

export function buildAgreementMoney(input: {
  quotationId: string;
  quotationNumber?: string | null;
  agreement: {
    bookingId: string | null;
    agreementTotal: number;
    confirmationPercent: number;
    confirmationAmount: number;
    holdWindowDays: number;
    holdStartedAt: Date | string | null;
    confirmedAt?: Date | string | null;
  } | null;
  // With no agreement yet: the accepted quotation's total, so the card can still say what would be required.
  previewTotal?: number;
  invoices: AgreementMoneyInvoice[]; // only this agreement's invoices (same quotation)
  bookingConfirmed: boolean;
  weddingId?: string | null;
  now?: Date;
}): AgreementMoneyView {
  const { agreement } = input;
  const total = agreement?.agreementTotal ?? input.previewTotal ?? 0;
  const percent = agreement?.confirmationPercent ?? COMMERCIAL_RULES.confirmationPercent;
  const required = agreement?.confirmationAmount ?? requiredConfirmation(total);
  const windowDays = agreement?.holdWindowDays ?? COMMERCIAL_RULES.holdWindowDays;

  const invoices = input.invoices
    .filter((i) => i.kind !== 'OTHER')
    .map((i) => {
      const paid = i.payments.filter((p) => p.status === 'SUCCESS').reduce((s, p) => s + p.amount, 0);
      return { id: i.id, invoiceNumber: i.invoiceNumber, kind: i.kind, status: i.status, total: i.total, paid, outstanding: Math.max(0, i.total - paid) };
    });
  const received = invoices.reduce((s, i) => s + i.paid, 0);
  const payments = input.invoices
    .filter((i) => i.kind !== 'OTHER')
    .flatMap((i) =>
      i.payments
        .filter((p) => p.status === 'SUCCESS')
        .map((p) => ({ id: p.id, invoiceNumber: i.invoiceNumber, kind: i.kind, amount: p.amount, method: p.method, reference: p.reference ?? null, paidAt: iso(p.paidAt) as string, recordedByName: p.recordedByName ?? null, receiptId: p.receiptId ?? null })),
    )
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt));

  const status = confirmationStatus({ required, received, holdStartedAt: agreement?.holdStartedAt ? new Date(agreement.holdStartedAt) : null, holdWindowDays: windowDays, now: input.now });
  const outstanding = Math.max(0, total - received);
  const bookingConfirmed = input.bookingConfirmed;
  const readyToConfirm = status.state === 'CONFIRMED' && !bookingConfirmed;

  const advance = invoices.find((i) => i.kind === 'ADVANCE');
  const balance = invoices.find((i) => i.kind === 'BALANCE');
  let next: MoneyNext;
  if (outstanding === 0 && received > 0) next = { kind: 'DONE', label: 'Fully paid — nothing more to collect', invoiceId: null, invoiceNumber: null };
  else if (readyToConfirm) next = { kind: 'CONFIRM_BOOKING', label: 'Confirm the booking', invoiceId: null, invoiceNumber: null };
  else if (status.state !== 'CONFIRMED') {
    next = { kind: 'RECORD_PAYMENT', label: status.state === 'NOT_STARTED' ? `Record the first payment — ${inr(required)} confirms the booking` : `Record payment — ${inr(status.remaining)} more confirms the booking`, invoiceId: advance?.id ?? null, invoiceNumber: advance?.invoiceNumber ?? null };
  } else {
    const target = balance && balance.outstanding > 0 ? balance : advance && advance.outstanding > 0 ? advance : null;
    next = { kind: 'COLLECT_BALANCE', label: `Payment of ${inr(outstanding)} pending`, invoiceId: target?.id ?? null, invoiceNumber: target?.invoiceNumber ?? null };
  }

  const stateLabel =
    bookingConfirmed ? 'Booking confirmed'
    : status.state === 'CONFIRMED' ? 'Ready to confirm'
    : status.state === 'NOT_STARTED' ? 'No payment yet'
    : status.overdue ? 'Date held — hold period over'
    : `Date held — ${status.daysLeft === 0 ? 'ends today' : `${status.daysLeft} of ${windowDays} days left`}`;

  return {
    exists: agreement !== null,
    quotationId: input.quotationId,
    quotationNumber: input.quotationNumber ?? null,
    bookingId: agreement?.bookingId ?? null,
    weddingId: input.weddingId ?? null,
    agreementTotal: total,
    confirmationPercent: percent,
    confirmationAmount: required,
    holdWindowDays: windowDays,
    received,
    outstanding,
    state: status.state,
    remaining: status.remaining,
    daysLeft: status.daysLeft,
    overdue: status.overdue,
    holdStartedAt: iso(status.holdStartedAt),
    holdExpiresAt: iso(status.holdExpiresAt),
    bookingConfirmed,
    readyToConfirm,
    message: bookingConfirmed ? `Booking confirmed — ${inr(received)} received of the ${inr(total)} agreed.` : status.message,
    stateLabel,
    invoices,
    payments,
    next,
  };
}
