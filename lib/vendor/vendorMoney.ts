// What Shaadi Shopping owes a vendor, and what it has paid (25 Nov 2026). ONE calculation for both sides: the admin's wedding page
// (vendor-wise) and the vendor's own Payments screen use this, so the two can never disagree. Pure: no database.
//
// Before this, both screens added up Payout rows only — and a Payout exists only after an admin pressed "Calculate payout" on a
// COMPLETED work, once, for the whole amount. Confirmed work showed ₹0. Here every number comes from records that exist:
//   work value   = VendorBooking.agreedPrice of CONFIRMED and COMPLETED work (a declined / cancelled work is not owed)
//   commission   = the Payout's own snapshot when one exists; otherwise the vendor category's current rate (CommissionRate) —
//                  an estimate until paid out, and null (unknown, never ₹0) when no rate is set up
//   net          = work value − commission (what the vendor receives)
//   paid         = VendorPayment entries that are not voided + an older Payout marked PAID (its net amount)
//   remaining    = net − paid (negative = paid more than is owed, e.g. on work cancelled after an advance)

export type WorkStatus = 'AWAITING_VENDOR' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';

export const WORK_STATUS_WORDS: Record<WorkStatus, string> = {
  AWAITING_VENDOR: 'Waiting for the vendor to confirm',
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

export interface AssignmentFacts {
  id: string;
  status: string; // VendorBookingStatus
  venueStatus: string; // VenueBookingStatus — the setup steps the vendor moves through
  agreedPrice: number;
  currentRate: number | null; // the vendor category's commission % today (null: none set up)
  payout: { status: string; commissionRate: number; commissionAmount: number; netAmount: number } | null;
  payments: { amount: number; voided: boolean }[];
}

export interface AssignmentMoney {
  id: string;
  workStatus: WorkStatus;
  owed: boolean; // counts in the work value (confirmed or completed)
  workValue: number; // 0 when not owed
  commissionRate: number | null;
  commission: number | null; // null: no rate set up
  commissionIsEstimate: boolean; // true until a payout fixed it
  net: number | null;
  paid: number;
  remaining: number | null;
  // What the vendor is paid for this work whatever its status — the one amount a vendor ever sees (money design rule 1, 25 Nov 2026).
  // A work still waiting for the vendor's yes shows what they would be paid; null: no commission rate set up.
  payable: number | null;
}

export function workStatusOf(status: string, venueStatus: string): WorkStatus {
  if (status === 'COMPLETED') return 'COMPLETED';
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'DECLINED') return 'DECLINED';
  if (status !== 'CONFIRMED') return 'AWAITING_VENDOR'; // PENDING_VENDOR_CONFIRMATION / CUSTOMER_APPROVAL_PENDING
  return venueStatus === 'PENDING' ? 'NOT_STARTED' : 'IN_PROGRESS'; // READY_FOR_SETUP … COMPLETED (setup done, work not closed)
}

export function assignmentMoney(a: AssignmentFacts): AssignmentMoney {
  const owed = a.status === 'CONFIRMED' || a.status === 'COMPLETED';
  const workValue = owed ? a.agreedPrice : 0;
  const fixed = a.payout !== null;
  const commissionRate = fixed ? a.payout!.commissionRate : a.currentRate;
  const commission = !owed ? 0 : fixed ? a.payout!.commissionAmount : commissionRate === null ? null : Math.round((workValue * commissionRate) / 100);
  const net = !owed ? 0 : fixed ? a.payout!.netAmount : commission === null ? null : workValue - commission;
  const paid = a.payments.filter((p) => !p.voided).reduce((s, p) => s + p.amount, 0) + (a.payout?.status === 'PAID' ? a.payout.netAmount : 0);
  return {
    id: a.id,
    workStatus: workStatusOf(a.status, a.venueStatus),
    owed,
    workValue,
    commissionRate,
    commission,
    commissionIsEstimate: owed && !fixed,
    net,
    paid,
    remaining: net === null ? null : net - paid,
    payable: fixed ? a.payout!.netAmount : commissionRate === null ? null : a.agreedPrice - Math.round((a.agreedPrice * commissionRate) / 100),
  };
}

// ---- What a vendor (or venue working for Shaadi Shopping) may see: their own amount and payments, nothing else ----
// Never the couple's price, the commission or the margin (money design rule 1). Built only from AssignmentMoney.payable / paid.

export interface VendorTotals {
  payable: number | null; // owed works: what they are paid in all (null: a rate is missing)
  paid: number;
  remaining: number | null;
  awaitingPayable: number | null; // works waiting for their yes: what those would pay
  works: number;
  completed: number;
}

export function vendorTotals(rows: AssignmentMoney[]): VendorTotals {
  const owed = rows.filter((r) => r.owed);
  const waiting = rows.filter((r) => r.workStatus === 'AWAITING_VENDOR');
  const sumOrNull = (list: AssignmentMoney[]) => (list.some((r) => r.payable === null) ? null : list.reduce((s, r) => s + (r.payable ?? 0), 0));
  const payable = sumOrNull(owed);
  const paid = rows.reduce((s, r) => s + r.paid, 0);
  return {
    payable,
    paid,
    remaining: payable === null ? null : payable - paid,
    awaitingPayable: sumOrNull(waiting),
    works: owed.length,
    completed: owed.filter((r) => r.workStatus === 'COMPLETED').length,
  };
}

export interface MoneyTotals {
  workValue: number;
  commission: number | null; // null when any owed work has no rate set up
  net: number | null;
  paid: number;
  remaining: number | null;
  awaitingVendorValue: number; // agreed but the vendor has not confirmed yet (not owed yet)
  works: number; // owed works
  completed: number;
}

export function moneyTotals(rows: AssignmentMoney[], all: { id: string; status: string; agreedPrice: number }[] = []): MoneyTotals {
  const owed = rows.filter((r) => r.owed);
  const unknown = owed.some((r) => r.commission === null);
  const sum = (f: (r: AssignmentMoney) => number) => rows.reduce((s, r) => s + f(r), 0);
  const paid = sum((r) => r.paid);
  const net = unknown ? null : sum((r) => r.net ?? 0);
  return {
    workValue: sum((r) => r.workValue),
    commission: unknown ? null : sum((r) => r.commission ?? 0),
    net,
    paid,
    remaining: net === null ? null : net - paid,
    awaitingVendorValue: all.filter((b) => b.status === 'PENDING_VENDOR_CONFIRMATION' || b.status === 'CUSTOMER_APPROVAL_PENDING').reduce((s, b) => s + b.agreedPrice, 0),
    works: owed.length,
    completed: owed.filter((r) => r.workStatus === 'COMPLETED').length,
  };
}

// ---- Recording a payment ----

export const PAYMENT_METHODS = [
  { id: 'UPI', label: 'UPI' },
  { id: 'BANK_TRANSFER', label: 'Bank transfer' },
  { id: 'CASH', label: 'Cash' },
  { id: 'CHEQUE', label: 'Cheque' },
  { id: 'OTHER', label: 'Other' },
] as const;
export const methodLabel = (id: string) => PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id;

export interface PaymentInput {
  amount: unknown;
  paidOn: unknown; // YYYY-MM-DD (India date)
  method: unknown;
  reference?: unknown;
  note?: unknown;
}

// `remaining` is what is still owed on this work (null: unknown because no commission rate is set up — then nothing can be
// checked against it, so recording is refused until the rate exists). `today` is the India date.
export function checkPayment(input: PaymentInput, remaining: number | null, today: string): { ok: true; value: { amount: number; paidOn: Date; method: string; reference: string | null; note: string | null } } | { ok: false; error: string } {
  const raw = typeof input.amount === 'number' ? input.amount : Number(String(input.amount ?? '').replace(/[,\s₹]/g, ''));
  if (!Number.isInteger(raw) || raw <= 0) return { ok: false, error: 'Enter the amount paid in whole rupees' };
  if (remaining === null) return { ok: false, error: 'No commission rate is set up for this vendor’s category, so what they are owed is not known yet' };
  if (raw > remaining) return { ok: false, error: remaining <= 0 ? 'Nothing is left to pay on this work' : `That is more than is left to pay on this work (₹${remaining.toLocaleString('en-IN')})` };
  const day = typeof input.paidOn === 'string' ? input.paidOn.trim() : '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00:00Z`) : null;
  if (!d || Number.isNaN(d.getTime()) || !d.toISOString().startsWith(day)) return { ok: false, error: 'Choose the date it was paid' };
  if (day > today) return { ok: false, error: 'The date cannot be in the future' };
  const method = typeof input.method === 'string' ? input.method : '';
  if (!PAYMENT_METHODS.some((m) => m.id === method)) return { ok: false, error: 'Choose how it was paid' };
  const reference = typeof input.reference === 'string' ? input.reference.trim() : '';
  if (reference.length > 100) return { ok: false, error: 'Keep the reference under 100 characters' };
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > 300) return { ok: false, error: 'Keep the note under 300 characters' };
  return { ok: true, value: { amount: raw, paidOn: d, method, reference: reference || null, note: note || null } };
}

export function checkVoidReason(reason: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const r = typeof reason === 'string' ? reason.replace(/\s+/g, ' ').trim() : '';
  if (r.length < 3) return { ok: false, error: 'Say why this payment entry is wrong' };
  if (r.length > 200) return { ok: false, error: 'Keep the reason under 200 characters' };
  return { ok: true, value: r };
}
