// Vendor work orders and pricing models (money design v1, PR 4, 25 Nov 2026). Pure: the rules only — services/vendorWorkOrder.service.ts
// loads the records and writes. A work order is issued when the vendor confirms, numbered WO-YYYYMM-NNNN, and frozen (database rule).
//
// Privacy (rule 1): a vendor sees the scope and their own amount — never the client price, the commission or the margin. Those are
// stored on the work order for the team (margin and commission: founder only), and `vendorWorkOrderView` is the only shape a vendor
// is ever sent.

import { assignmentTerms, type AssignmentFacts, type PricingModel } from '@/lib/vendor/vendorMoney';

export const WORK_ORDER_TERMS =
  'Deliver the service described above for this function, on the date and at the place shown. Confirm the timings with the ' +
  'Shaadi Shopping coordinator a day before. Payments are made by Shaadi Shopping against this work order; the final payment is ' +
  'made once the work is completed and checked. Any change to the scope or the amount is made as a written adjustment to this ' +
  'work order.';

export interface WorkOrderScope {
  weddingNumber: string;
  coupleName: string | null;
  functionName: string;
  functionDate: string; // YYYY-MM-DD (India)
  startTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  city: string | null;
  guestCount: number | null;
  service: string; // the vendor's category, e.g. "Decorators"
  packageName: string | null;
  deliverables: string | null;
  terms: string;
}

export interface IssuableWorkOrder {
  pricingModel: PricingModel;
  vendorPayable: number;
  clientPrice: number;
  commissionRate: number | null;
  commissionAmount: number | null;
  margin: number;
  scope: WorkOrderScope;
}

// The frozen figures + scope for a work order, or why one cannot be issued (the confirmation itself still goes ahead).
export function buildWorkOrder(facts: AssignmentFacts, scope: Omit<WorkOrderScope, 'terms'>): { ok: true; value: IssuableWorkOrder } | { ok: false; reason: string } {
  // An older payout keeps its own figures (a historical work order must match what was already settled); otherwise the model's terms.
  const t = assignmentTerms({ ...facts, workOrder: null });
  if (t.payable === null) {
    return { ok: false, reason: t.pricingModel === 'FIXED' ? 'the fixed vendor price is not set' : 'no commission rate is set up for this vendor’s category' };
  }
  if (t.payable < 0) return { ok: false, reason: 'the vendor amount would be below zero' };
  if (t.pricingModel === 'COMMISSION' && t.commission !== null && t.payable !== t.clientPrice - t.commission) {
    return { ok: false, reason: 'the older payout no longer matches the agreed price — settle it by hand first' };
  }
  return {
    ok: true,
    value: {
      pricingModel: t.pricingModel,
      vendorPayable: t.payable,
      clientPrice: t.clientPrice,
      commissionRate: t.pricingModel === 'COMMISSION' ? t.commissionRate : null,
      commissionAmount: t.pricingModel === 'COMMISSION' ? t.commission : null,
      margin: t.clientPrice - t.payable,
      scope: { ...scope, terms: WORK_ORDER_TERMS },
    },
  };
}

// What a vendor is sent about one of their work orders — an explicit allow-list.
export interface VendorWorkOrderView {
  id: string;
  number: string;
  status: 'ISSUED' | 'CANCELLED';
  issuedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  vendorPayable: number;
  scope: WorkOrderScope;
}

export function vendorWorkOrderView(w: { id: string; number: string; status: string; issuedAt: Date; cancelledAt: Date | null; cancelReason: string | null; vendorPayable: number; scope: unknown }): VendorWorkOrderView {
  const s = (w.scope ?? {}) as Partial<WorkOrderScope>;
  return {
    id: w.id,
    number: w.number,
    status: w.status === 'CANCELLED' ? 'CANCELLED' : 'ISSUED',
    issuedAt: w.issuedAt.toISOString(),
    cancelledAt: w.cancelledAt?.toISOString() ?? null,
    cancelReason: w.cancelReason,
    vendorPayable: w.vendorPayable,
    scope: {
      weddingNumber: s.weddingNumber ?? '',
      coupleName: s.coupleName ?? null,
      functionName: s.functionName ?? '',
      functionDate: s.functionDate ?? '',
      startTime: s.startTime ?? null,
      venueName: s.venueName ?? null,
      venueAddress: s.venueAddress ?? null,
      city: s.city ?? null,
      guestCount: s.guestCount ?? null,
      service: s.service ?? '',
      packageName: s.packageName ?? null,
      deliverables: s.deliverables ?? null,
      terms: s.terms ?? WORK_ORDER_TERMS,
    },
  };
}

// ---- Setting the pricing model (founder only, before the work order is issued) ----

export interface PricingInput {
  model: unknown; // 'COMMISSION' | 'FIXED'
  vendorPrice?: unknown; // FIXED: the vendor's agreed price, whole rupees
  acceptNegativeMargin?: unknown; // FIXED above the client price: must be confirmed
  reason?: unknown; // required with acceptNegativeMargin
}

export function checkPricing(input: PricingInput, clientPrice: number): { ok: true; value: { pricingModel: PricingModel; vendorPrice: number | null; note: string | null } } | { ok: false; error: string } {
  if (input.model === 'COMMISSION') return { ok: true, value: { pricingModel: 'COMMISSION', vendorPrice: null, note: null } };
  if (input.model !== 'FIXED') return { ok: false, error: 'Choose commission or a fixed vendor price' };
  const raw = typeof input.vendorPrice === 'number' ? input.vendorPrice : Number(String(input.vendorPrice ?? '').replace(/[,\s₹]/g, ''));
  if (!Number.isInteger(raw) || raw < 0 || String(input.vendorPrice ?? '').trim() === '') return { ok: false, error: 'Enter the vendor’s fixed price in whole rupees' };
  if (raw > clientPrice) {
    const reason = typeof input.reason === 'string' ? input.reason.replace(/\s+/g, ' ').trim() : '';
    if (input.acceptNegativeMargin !== true) return { ok: false, error: `The vendor price is ₹${(raw - clientPrice).toLocaleString('en-IN')} above what the couple pays for this service — confirm it to go ahead` };
    if (reason.length < 3) return { ok: false, error: 'Say why we pay the vendor more than the couple pays for this service' };
    return { ok: true, value: { pricingModel: 'FIXED', vendorPrice: raw, note: `negative margin accepted: ${reason}` } };
  }
  return { ok: true, value: { pricingModel: 'FIXED', vendorPrice: raw, note: null } };
}
