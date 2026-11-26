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

export type WorkStatus = 'AWAITING_VENDOR' | 'NOT_STARTED' | 'IN_PROGRESS' | 'AWAITING_CHECK' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';

export const WORK_STATUS_WORDS: Record<WorkStatus, string> = {
  AWAITING_VENDOR: 'Waiting for the vendor to confirm',
  AWAITING_CHECK: 'Done — waiting for our check',
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

export type PricingModel = 'COMMISSION' | 'FIXED';

export interface WorkOrderTerms {
  status: string; // ISSUED / CANCELLED — only an ISSUED one fixes the terms
  pricingModel: PricingModel;
  vendorPayable: number;
  clientPrice: number;
  commissionRate: number | null;
  commissionAmount: number | null;
  // changes after issue (PR 6): the vendor's amount and the couple's price move by these, never by editing the work order
  adjustments?: { payableDelta: number; clientPriceDelta: number }[];
}

export interface AssignmentFacts {
  id: string;
  status: string; // VendorBookingStatus
  venueStatus: string; // VenueBookingStatus — the setup steps the vendor moves through
  agreedPrice: number; // the client price share for this service
  currentRate: number | null; // the vendor category's commission % today (null: none set up)
  pricingModel?: PricingModel | null; // null / absent: an older assignment — commission, as before
  vendorPrice?: number | null; // FIXED only
  workOrder?: WorkOrderTerms | null;
  vendorDone?: boolean; // the vendor said the work is done (not yet verified)
  payout: { status: string; commissionRate: number; commissionAmount: number; netAmount: number } | null;
  payments: { amount: number; voided: boolean }[];
}

export interface AssignmentMoney {
  id: string;
  workStatus: WorkStatus;
  owed: boolean; // counts in the work value (confirmed or completed)
  pricingModel: PricingModel;
  workOrderIssued: boolean; // the terms are frozen on an issued work order
  workValue: number; // the client price share; 0 when not owed
  commissionRate: number | null; // COMMISSION only
  commission: number | null; // COMMISSION: null = no rate set up; FIXED: null (there is none)
  commissionIsEstimate: boolean; // COMMISSION at today's rate, nothing frozen yet
  margin: number | null; // client price − vendor payable (internal; founder only)
  net: number | null; // what the vendor gets for owed work (0 when not owed); null = unknown
  paid: number;
  remaining: number | null;
  // What the vendor is paid for this work whatever its status — the one amount a vendor ever sees (money design rule 1, 25 Nov 2026).
  // A work still waiting for the vendor's yes shows what they would be paid; null: unknown (no rate, or a fixed price not set).
  payable: number | null;
}

// The terms of one work, from the first that applies (25 Nov 2026, money design v1 PR 4):
//   1. an older payout (it fixed the commission when it was calculated)
//   2. an ISSUED work order (frozen when the vendor confirmed)
//   3. the assignment's pricing model: FIXED → the vendor price; COMMISSION (or none set) → the category's current rate
// The two models are never mixed: a FIXED work has no commission; a COMMISSION work has no vendor price.
export function assignmentTerms(a: AssignmentFacts): { pricingModel: PricingModel; clientPrice: number; commissionRate: number | null; commission: number | null; payable: number | null; frozen: boolean } {
  if (a.payout) return { pricingModel: 'COMMISSION', clientPrice: a.agreedPrice, commissionRate: a.payout.commissionRate, commission: a.payout.commissionAmount, payable: a.payout.netAmount, frozen: true };
  const wo = a.workOrder && a.workOrder.status === 'ISSUED' ? a.workOrder : null;
  if (wo) {
    const adj = wo.adjustments ?? [];
    const payable = wo.vendorPayable + adj.reduce((n, x) => n + x.payableDelta, 0);
    const clientPrice = wo.clientPrice + adj.reduce((n, x) => n + x.clientPriceDelta, 0);
    // commission model: our share is what is left between the couple's price and the vendor's amount once adjusted
    const commission = wo.pricingModel === 'COMMISSION' ? (adj.length ? clientPrice - payable : wo.commissionAmount) : null;
    return { pricingModel: wo.pricingModel, clientPrice, commissionRate: wo.commissionRate, commission, payable, frozen: true };
  }
  if (a.pricingModel === 'FIXED') return { pricingModel: 'FIXED', clientPrice: a.agreedPrice, commissionRate: null, commission: null, payable: a.vendorPrice ?? null, frozen: false };
  const rate = a.currentRate;
  const commission = rate === null ? null : Math.round((a.agreedPrice * rate) / 100);
  return { pricingModel: 'COMMISSION', clientPrice: a.agreedPrice, commissionRate: rate, commission, payable: commission === null ? null : a.agreedPrice - commission, frozen: false };
}

export function workStatusOf(status: string, venueStatus: string, vendorDone = false): WorkStatus {
  if (status === 'COMPLETED') return 'COMPLETED';
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'DECLINED') return 'DECLINED';
  if (status !== 'CONFIRMED') return 'AWAITING_VENDOR'; // PENDING_VENDOR_CONFIRMATION / CUSTOMER_APPROVAL_PENDING
  if (vendorDone) return 'AWAITING_CHECK'; // the vendor says it is done; staff have not verified it yet (PR 6)
  return venueStatus === 'PENDING' ? 'NOT_STARTED' : 'IN_PROGRESS'; // READY_FOR_SETUP … COMPLETED (setup done, work not closed)
}

export function assignmentMoney(a: AssignmentFacts): AssignmentMoney {
  const owed = a.status === 'CONFIRMED' || a.status === 'COMPLETED';
  const t = assignmentTerms(a);
  const net = !owed ? 0 : t.payable;
  const paid = a.payments.filter((p) => !p.voided).reduce((s, p) => s + p.amount, 0) + (a.payout?.status === 'PAID' ? a.payout.netAmount : 0);
  return {
    id: a.id,
    workStatus: workStatusOf(a.status, a.venueStatus, a.vendorDone ?? false),
    owed,
    pricingModel: t.pricingModel,
    workOrderIssued: !!(a.workOrder && a.workOrder.status === 'ISSUED'),
    workValue: owed ? t.clientPrice : 0,
    commissionRate: t.commissionRate,
    commission: !owed ? (t.pricingModel === 'FIXED' ? null : 0) : t.commission,
    commissionIsEstimate: owed && !t.frozen && t.pricingModel === 'COMMISSION',
    margin: !owed ? 0 : t.payable === null ? null : t.clientPrice - t.payable,
    net,
    paid,
    remaining: net === null ? null : net - paid,
    payable: t.payable,
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
  commission: number | null; // commission-model works only; null when one of those has no rate set up
  margin: number | null; // client price − vendor payable over owed works (internal; founder only); null when one is unknown
  net: number | null;
  paid: number;
  remaining: number | null;
  awaitingVendorValue: number; // agreed but the vendor has not confirmed yet (not owed yet)
  works: number; // owed works
  completed: number;
}

export function moneyTotals(rows: AssignmentMoney[], all: { id: string; status: string; agreedPrice: number }[] = []): MoneyTotals {
  const owed = rows.filter((r) => r.owed);
  const unknown = owed.some((r) => r.net === null);
  const commissionUnknown = owed.some((r) => r.pricingModel === 'COMMISSION' && r.commission === null);
  const sum = (f: (r: AssignmentMoney) => number) => rows.reduce((s, r) => s + f(r), 0);
  const paid = sum((r) => r.paid);
  const net = unknown ? null : sum((r) => r.net ?? 0);
  return {
    workValue: sum((r) => r.workValue),
    commission: commissionUnknown ? null : owed.reduce((s, r) => s + (r.pricingModel === 'COMMISSION' ? (r.commission ?? 0) : 0), 0),
    margin: unknown ? null : owed.reduce((s, r) => s + (r.margin ?? 0), 0),
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
  finalOverrideReason?: unknown; // PR 6: why the final payment is made before the work is verified
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
