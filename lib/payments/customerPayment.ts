// Roadmap 1.3 — the couple pays by UPI from the proposal link and says "I have paid" (docs/wedding-os/08-quotation.md §20).
//
// A submission is a CLAIM, never money: what was received, Date Held and Confirmed still come only from Payment rows
// (lib/commercial/view.ts). Staff verify a claim, and only then is a Payment recorded — through the normal Money v1 path.
//
// Pure (no database). Server-side only, because ValidationError lives in lib/errors; the page imports types from here and the link
// builder from lib/payments/upi.ts.
import { ValidationError } from '@/lib/errors';
import type { AgreementMoneyView } from '@/lib/commercial/view';
import type { ConfirmationState } from '@/lib/commercial/rules';
import type { UpiPayee } from '@/lib/payments/upi';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// ---------- "I have paid" ----------

export const NOTE_MAX = 500;
export const PENDING_MAX = 3; // open claims per proposal — more than enough for real use, and a cap on abuse
export const CLAIM_MAX_AGE_DAYS = 90;
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'] as const;

// UTRs are shown with spaces or dashes by some apps; the bank statement has them without. UPI's own is 12 digits; a bank transfer
// reference can be longer and alphanumeric.
export function normaliseUtr(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\s-]/g, '').toUpperCase() : '';
}

export interface PaymentClaim {
  amount: number;
  utr: string;
  paidOn: Date;
  note: string | null;
}

export function validatePaymentClaim(
  input: { amount: unknown; utr: unknown; paidOn?: unknown; note?: unknown },
  ctx: { outstanding: number; now: Date }
): PaymentClaim {
  const amount = typeof input.amount === 'number' ? input.amount : Number(String(input.amount ?? '').replace(/[,\s₹]/g, ''));
  if (!Number.isInteger(amount) || amount <= 0) throw new ValidationError('Enter the amount you paid in whole rupees');
  if (ctx.outstanding <= 0) throw new ValidationError('Nothing more is due on this booking');
  if (amount > ctx.outstanding) throw new ValidationError(`The amount is more than what is due (${inr(ctx.outstanding)})`);

  const utr = normaliseUtr(input.utr);
  if (!/^[A-Z0-9]{6,35}$/.test(utr)) throw new ValidationError('Enter the UTR / transaction reference from your UPI app (usually 12 digits)');

  let paidOn = ctx.now;
  if (typeof input.paidOn === 'string' && input.paidOn.trim()) {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn.trim()) ? `${input.paidOn.trim()}T12:00:00+05:30` : input.paidOn.trim());
    if (Number.isNaN(d.getTime())) throw new ValidationError('Enter the date you paid');
    if (d.getTime() > ctx.now.getTime() + 36 * 3_600_000) throw new ValidationError('The payment date cannot be in the future');
    if (d.getTime() < ctx.now.getTime() - CLAIM_MAX_AGE_DAYS * 86_400_000) throw new ValidationError('That date is too long ago — please call us');
    paidOn = d;
  }

  const noteText = typeof input.note === 'string' ? input.note.trim() : '';
  if (noteText.length > NOTE_MAX) throw new ValidationError(`Please keep the note under ${NOTE_MAX} characters`);
  return { amount, utr, paidOn, note: noteText || null };
}

export function checkProof(file: { type: string; size: number } | null): string | null {
  if (!file || file.size === 0) return null;
  if (!(PROOF_TYPES as readonly string[]).includes(file.type)) return 'The screenshot must be a photo (JPG, PNG, WebP, HEIC) or a PDF';
  if (file.size > PROOF_MAX_BYTES) return 'The screenshot must be under 5 MB';
  return null;
}

// ---------- receipts ----------

// One receipt = one payment as received, even when it was split across the advance and balance invoices (shared receiptId).
export const receiptNumber = (id: string) => `RCPT-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

const METHOD_LABEL: Record<string, string> = { UPI: 'UPI', BANK_TRANSFER: 'Bank transfer', CASH: 'Cash', CHEQUE: 'Cheque', upi: 'UPI', card: 'Card', netbanking: 'Net banking', wallet: 'Wallet' };
export const methodLabel = (m: string) => METHOD_LABEL[m] ?? m;

export interface CustomerReceipt {
  number: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
}

export function groupReceipts(payments: AgreementMoneyView['payments']): CustomerReceipt[] {
  const byId = new Map<string, CustomerReceipt>();
  for (const p of payments) {
    const id = p.receiptId ?? p.id;
    const found = byId.get(id);
    if (found) found.amount += p.amount;
    else byId.set(id, { number: receiptNumber(id), amount: p.amount, method: methodLabel(p.method), reference: p.reference, paidAt: p.paidAt });
  }
  return [...byId.values()].sort((a, b) => a.paidAt.localeCompare(b.paidAt));
}

// ---------- what the couple sees (an explicit allow-list) ----------

export interface SubmissionInput {
  id: string;
  amount: number;
  utr: string;
  createdAt: Date | string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectReason: string | null;
}

export interface ProposalPayments {
  state: ConfirmationState;
  bookingConfirmed: boolean;
  total: number;
  confirmationPercent: number;
  confirmationAmount: number;
  received: number;
  outstanding: number;
  remainingToConfirm: number;
  dueDate: string | null; // while the date is held: when the hold ends
  payNow: number; // the suggested amount: what still confirms the booking, else the whole balance
  inReview: number; // claimed and not yet verified — shown, never counted
  upi: UpiPayee | null;
  receipts: CustomerReceipt[];
  submissions: { id: string; amount: number; utr: string; submittedAt: string; status: 'PENDING' | 'REJECTED'; rejectReason: string | null }[];
  canSubmit: boolean;
}

const iso = (d: Date | string) => (d instanceof Date ? d : new Date(d)).toISOString();

// Never carries who recorded a payment, invoice ids, staff notes or proof files — only the couple's own figures and receipts.
export function toProposalPayments(money: AgreementMoneyView, submissions: SubmissionInput[], upi: UpiPayee | null): ProposalPayments {
  const open = submissions.filter((s) => s.status === 'PENDING');
  const inReview = open.reduce((s, x) => s + x.amount, 0);
  const remainingToConfirm = money.bookingConfirmed ? 0 : money.remaining;
  return {
    state: money.state,
    bookingConfirmed: money.bookingConfirmed,
    total: money.agreementTotal,
    confirmationPercent: money.confirmationPercent,
    confirmationAmount: money.confirmationAmount,
    received: money.received,
    outstanding: money.outstanding,
    remainingToConfirm,
    dueDate: money.state === 'DATE_HELD' && !money.bookingConfirmed ? money.holdExpiresAt : null,
    payNow: remainingToConfirm > 0 ? remainingToConfirm : money.outstanding,
    inReview,
    upi,
    receipts: groupReceipts(money.payments),
    // Verified claims appear as receipts; only the open and the refused ones are listed as claims.
    submissions: submissions
      .filter((s): s is SubmissionInput & { status: 'PENDING' | 'REJECTED' } => s.status !== 'VERIFIED')
      .map((s) => ({ id: s.id, amount: s.amount, utr: s.utr, submittedAt: iso(s.createdAt), status: s.status, rejectReason: s.rejectReason }))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    canSubmit: money.outstanding > 0 && open.length < PENDING_MAX,
  };
}
