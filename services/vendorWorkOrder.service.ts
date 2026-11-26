import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { auditAs } from '@/lib/finance/audit';
import { commissionRateRepository } from '@/repositories/commissionRate.repository';
import { generateWorkOrderNumber } from '@/services/documentNumber.service';
import { adjustmentLabel, buildWorkOrder, checkAdjustment, checkPricing, vendorWorkOrderView, type AdjustmentInput, type PricingInput, type VendorWorkOrderView, type WorkOrderScope } from '@/lib/vendor/workOrder';

// Vendor work orders and pricing models (money design v1, PR 4, 25 Nov 2026). The rules are in lib/vendor/workOrder.ts; this loads the
// records and writes. A work order is issued inside the same transaction that confirms the assignment, so it exists exactly when the
// confirmation does. It is frozen by the database (trigger work_order_frozen); it can only be cancelled, with who and why.

type Tx = Prisma.TransactionClient;
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const indiaDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);

async function rateFor(categoryId: string, tx: Tx): Promise<number | null> {
  try {
    return (await commissionRateRepository.findCurrentRate(categoryId, tx)).rate;
  } catch {
    return null;
  }
}

// One row of the historical work-order preview (PR 5) — exactly the columns the founder asked for, plus why a row cannot be issued.
export interface HistoricalRow {
  vendorBookingId: string;
  weddingNumber: string;
  vendorName: string;
  service: string;
  functionName: string;
  functionDate: string;
  status: string;
  agreedValue: number; // original agreed value (the couple's price share)
  pricingModel: 'COMMISSION' | 'FIXED';
  modelIsDefault: boolean; // no model set: commission, as before
  commissionRate: number | null;
  proposedPayable: number | null; // the work order's value
  paid: number;
  remaining: number | null;
  canIssue: boolean;
  reason: string | null;
}

export interface StaffWorkOrderView extends VendorWorkOrderView {
  pricingModel: 'COMMISSION' | 'FIXED';
  clientPrice: number;
  commissionRate: number | null; // founder only (null otherwise)
  commissionAmount: number | null; // founder only
  margin: number | null; // founder only
  historical: boolean;
  vendorName: string;
}

// What a work order for this assignment would be — the ONE place that works it out, used both to issue (on confirmation, or a
// historical one) and to preview (PR 5), so a preview can never show other figures than the ones issued.
async function planFor(db: Tx | typeof prisma, vendorBookingId: string) {
  const b = await db.vendorBooking.findUnique({
    where: { id: vendorBookingId },
    include: {
      vendor: { select: { name: true, categoryId: true, category: { select: { name: true } } } },
      vendorPackage: { select: { name: true, description: true } },
      payouts: { select: { status: true, commissionRate: true, commissionAmount: true, netAmount: true } },
      vendorPayments: { select: { amount: true, voidedAt: true } },
      weddingEvent: { select: { type: true, label: true, date: true, startTime: true, venueName: true, venueAddress: true, city: true, wedding: { select: { id: true, weddingNumber: true, guestCount: true, customer: { select: { name: true } }, couple: { select: { brideName: true, groomName: true } } } } } },
    },
  });
  if (!b) throw new NotFoundError('VendorBooking', vendorBookingId);
  const ev = b.weddingEvent;
  const scope: Omit<WorkOrderScope, 'terms'> = {
    weddingNumber: ev.wedding.weddingNumber,
    coupleName: ev.wedding.customer?.name || [ev.wedding.couple?.brideName, ev.wedding.couple?.groomName].filter(Boolean).join(' & ') || null,
    functionName: ev.label || ev.type.charAt(0) + ev.type.slice(1).toLowerCase().replace(/_/g, ' '),
    // The service's own day, category and words when its quotation line gave them (PR A), else the function's and the listing's.
    functionDate: indiaDay(b.serviceDate ?? ev.date),
    startTime: ev.startTime,
    venueName: ev.venueName,
    venueAddress: ev.venueAddress,
    city: ev.city,
    guestCount: ev.wedding.guestCount,
    service: b.serviceCategory ?? b.vendor.category?.name ?? 'Service',
    packageName: b.description ?? b.vendorPackage?.name ?? null,
    deliverables: b.vendorPackage?.description ?? null,
  };
  const payout = b.payouts[0] ?? null;
  const built = buildWorkOrder(
    { id: b.id, status: b.status, venueStatus: b.venueStatus, agreedPrice: b.agreedPrice, currentRate: await rateFor(b.vendor.categoryId, db as Tx), pricingModel: b.pricingModel, vendorPrice: b.vendorPrice, payout, payments: [] },
    scope
  );
  const paid = b.vendorPayments.filter((p) => p.voidedAt === null).reduce((s, p) => s + p.amount, 0) + (payout?.status === 'PAID' ? payout.netAmount : 0);
  return { b, ev, scope, built, paid };
}

export const vendorWorkOrderService = {
  // Issue the work order for a confirmed assignment, inside the caller's transaction. Idempotent: an existing one is returned. When it
  // cannot be issued (no rate, no fixed price) the confirmation still goes ahead and the timeline says why — the Money check lists it.
  // `expectPayable` (historical issue): refuse unless the amount is still exactly what the founder saw in the preview.
  async issueInTx(tx: Tx, vendorBookingId: string, actorId: string | null, opts: { historical?: boolean; expectPayable?: number } = {}) {
    const existing = await tx.vendorWorkOrder.findUnique({ where: { vendorBookingId } });
    if (existing) return { issued: false as const, workOrder: existing };
    const { b, ev, scope, built } = await planFor(tx, vendorBookingId);
    if (opts.expectPayable !== undefined && (!built.ok || built.value.vendorPayable !== opts.expectPayable)) {
      throw new ConflictError(`The amount for ${b.vendor.name} (${scope.weddingNumber} · ${scope.functionName}) has changed since the preview — reload it and check again`);
    }
    if (!built.ok) {
      await tx.activityLog.create({ data: { type: 'NOTE', summary: `Work order not issued for ${b.vendor.name}: ${built.reason}`, wedding: { connect: { id: ev.wedding.id } }, vendorBooking: { connect: { id: b.id } }, ...(actorId ? { performedBy: { connect: { id: actorId } } } : {}) } });
      return { issued: false as const, workOrder: null, reason: built.reason };
    }
    const number = await generateWorkOrderNumber(tx);
    const v = built.value;
    const workOrder = await tx.vendorWorkOrder.create({
      data: {
        number,
        vendorBooking: { connect: { id: b.id } },
        vendor: { connect: { id: b.vendorId } },
        pricingModel: v.pricingModel,
        vendorPayable: v.vendorPayable,
        clientPrice: v.clientPrice,
        commissionRate: v.commissionRate,
        commissionAmount: v.commissionAmount,
        margin: v.margin,
        scope: v.scope as unknown as Prisma.InputJsonValue,
        historical: opts.historical ?? false,
        issuedById: actorId,
      },
    });
    await tx.activityLog.create({ data: { type: 'STATUS_CHANGED', summary: `Work order ${number} issued to ${b.vendor.name}: ${inr(v.vendorPayable)} for ${scope.functionName}${opts.historical ? ' (issued later for an earlier confirmation)' : ''}`, wedding: { connect: { id: ev.wedding.id } }, vendorBooking: { connect: { id: b.id } }, ...(actorId ? { performedBy: { connect: { id: actorId } } } : {}) } });
    return { issued: true as const, workOrder };
  },

  // PR 5 — the founder's preview of work orders for assignments confirmed before work orders existed. READ-ONLY: nothing is written.
  async historicalPreview(): Promise<HistoricalRow[]> {
    const ids = await prisma.vendorBooking.findMany({ where: { status: { in: ['CONFIRMED', 'COMPLETED'] }, workOrder: null }, select: { id: true }, orderBy: { createdAt: 'asc' } });
    const rows: HistoricalRow[] = [];
    for (const { id } of ids) {
      const { b, scope, built, paid } = await planFor(prisma, id);
      const payable = built.ok ? built.value.vendorPayable : null;
      rows.push({
        vendorBookingId: b.id,
        weddingNumber: scope.weddingNumber,
        vendorName: b.vendor.name,
        service: scope.service,
        functionName: scope.functionName,
        functionDate: scope.functionDate,
        status: b.status,
        agreedValue: b.agreedPrice,
        pricingModel: built.ok ? built.value.pricingModel : (b.pricingModel ?? 'COMMISSION'),
        modelIsDefault: b.pricingModel === null,
        commissionRate: built.ok ? built.value.commissionRate : null,
        proposedPayable: payable,
        paid,
        remaining: payable === null ? null : payable - paid,
        canIssue: built.ok,
        reason: built.ok ? null : built.reason,
      });
    }
    return rows.sort((a, z) => a.weddingNumber.localeCompare(z.weddingNumber) || a.functionDate.localeCompare(z.functionDate));
  },

  // Issue historical work orders for the rows the founder ticked — all in one transaction, all or none; each only at exactly the amount
  // shown in the preview (refused if anything changed since).
  async issueHistorical(selections: { vendorBookingId: string; expectedPayable: number }[], actorId: string | null) {
    if (!Array.isArray(selections) || selections.length === 0) throw new ValidationError('Tick at least one row');
    if (selections.length > 100) throw new ValidationError('At most 100 at a time');
    const clean = selections.map((s) => ({ vendorBookingId: String(s?.vendorBookingId ?? ''), expectedPayable: Number(s?.expectedPayable) }));
    if (clean.some((s) => !s.vendorBookingId || !Number.isInteger(s.expectedPayable) || s.expectedPayable < 0)) throw new ValidationError('A ticked row is not valid — reload the preview');
    return prisma.$transaction(async (tx) => {
      await auditAs(tx, actorId, 'historical work orders approved in the preview');
      const issued: { vendorBookingId: string; number: string }[] = [];
      for (const s of clean) {
        const b = await tx.vendorBooking.findUnique({ where: { id: s.vendorBookingId }, select: { status: true, workOrder: { select: { number: true } } } });
        if (!b) throw new NotFoundError('VendorBooking', s.vendorBookingId);
        if (b.workOrder) throw new ConflictError(`Work order ${b.workOrder.number} already exists for one of the ticked rows — reload the preview`);
        if (b.status !== 'CONFIRMED' && b.status !== 'COMPLETED') throw new ConflictError('A ticked work is no longer confirmed — reload the preview');
        const r = await vendorWorkOrderService.issueInTx(tx, s.vendorBookingId, actorId, { historical: true, expectPayable: s.expectedPayable });
        if (!r.issued || !r.workOrder) throw new ConflictError('A ticked row could not be issued — reload the preview');
        issued.push({ vendorBookingId: s.vendorBookingId, number: r.workOrder.number });
      }
      return issued;
    }, { timeout: 60_000 });
  },

  // PR 6 — a change after the work order is issued: never an edit, an adjustment (full money access on the wedding; the route checks).
  // The vendor's amount becomes the work order's plus every adjustment, never below what was already paid (also a database rule).
  async addAdjustment(weddingId: string, vendorBookingId: string, input: AdjustmentInput, actorId: string | null) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM vendor_bookings WHERE id = ${vendorBookingId} FOR UPDATE`;
      const b = await tx.vendorBooking.findFirst({
        where: { id: vendorBookingId, weddingEvent: { weddingId } },
        include: { vendor: { select: { name: true } }, workOrder: { include: { adjustments: { select: { payableDelta: true } } } }, vendorPayments: { select: { amount: true, voidedAt: true } }, payouts: { select: { status: true, netAmount: true } } },
      });
      if (!b) throw new NotFoundError('VendorBooking', vendorBookingId);
      if (!b.workOrder || b.workOrder.status !== 'ISSUED') throw new ConflictError('There is no issued work order for this work — change the price directly while it is not yet confirmed');
      const payableNow = b.workOrder.vendorPayable + b.workOrder.adjustments.reduce((n, x) => n + x.payableDelta, 0);
      const paid = b.vendorPayments.filter((p) => p.voidedAt === null).reduce((n, p) => n + p.amount, 0) + b.payouts.filter((p) => p.status === 'PAID').reduce((n, p) => n + p.netAmount, 0);
      const c = checkAdjustment(input, payableNow, paid);
      if (!c.ok) throw new ValidationError(c.error);
      await auditAs(tx, actorId, c.value.reason);
      const adj = await tx.workOrderAdjustment.create({ data: { workOrder: { connect: { id: b.workOrder.id } }, kind: c.value.kind, payableDelta: c.value.payableDelta, clientPriceDelta: c.value.clientPriceDelta, reason: c.value.reason, createdById: actorId } });
      const after = payableNow + c.value.payableDelta;
      await tx.activityLog.create({
        data: {
          type: 'STATUS_CHANGED',
          summary: `Work order ${b.workOrder.number} adjusted (${adjustmentLabel(c.value.kind).toLowerCase()}): ${c.value.payableDelta > 0 ? '+' : '−'}${inr(Math.abs(c.value.payableDelta))} for ${b.vendor.name} — now ${inr(after)}. ${c.value.reason}`,
          wedding: { connect: { id: weddingId } },
          vendorBooking: { connect: { id: b.id } },
          ...(actorId ? { performedBy: { connect: { id: actorId } } } : {}),
        },
      });
      return { adjustment: adj, payableNow: after };
    });
  },

  // Cancel an assignment's issued work order (the assignment was cancelled or replaced), inside the caller's transaction.
  async cancelInTx(tx: Tx, vendorBookingId: string, actorId: string | null, reason: string) {
    const wo = await tx.vendorWorkOrder.findUnique({ where: { vendorBookingId } });
    if (!wo || wo.status !== 'ISSUED') return null;
    return tx.vendorWorkOrder.update({ where: { id: wo.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: actorId, cancelReason: reason.trim() || 'Assignment cancelled' } });
  },

  // Founder only (the route checks): commission or a fixed vendor price, before the work order is issued.
  async setPricing(weddingId: string, vendorBookingId: string, input: PricingInput, actorId: string | null) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM vendor_bookings WHERE id = ${vendorBookingId} FOR UPDATE`;
      const b = await tx.vendorBooking.findFirst({ where: { id: vendorBookingId, weddingEvent: { weddingId } }, include: { vendor: { select: { name: true } }, workOrder: { select: { number: true, status: true } } } });
      if (!b) throw new NotFoundError('VendorBooking', vendorBookingId);
      if (b.workOrder?.status === 'ISSUED') throw new ConflictError(`Work order ${b.workOrder.number} is issued — its amount is locked; changes are made as adjustments`);
      if (b.status === 'CANCELLED' || b.status === 'DECLINED' || b.status === 'COMPLETED') throw new ConflictError('This work is closed');
      const c = checkPricing(input, b.agreedPrice);
      if (!c.ok) throw new ValidationError(c.error);
      await auditAs(tx, actorId, c.value.note);
      const updated = await tx.vendorBooking.update({ where: { id: b.id }, data: { pricingModel: c.value.pricingModel, vendorPrice: c.value.vendorPrice }, select: { id: true, pricingModel: true, vendorPrice: true } });
      await tx.activityLog.create({
        data: {
          type: 'NOTE',
          summary: c.value.pricingModel === 'FIXED' ? `Pricing for ${b.vendor.name}: fixed vendor price ${inr(c.value.vendorPrice!)}${c.value.note ? ` (${c.value.note})` : ''}` : `Pricing for ${b.vendor.name}: commission at the category rate`,
          wedding: { connect: { id: weddingId } },
          vendorBooking: { connect: { id: b.id } },
          ...(actorId ? { performedBy: { connect: { id: actorId } } } : {}),
        },
      });
      return updated;
    });
  },

  // A vendor's own work order: only theirs, only the vendor-safe view.
  async forVendor(vendorId: string, workOrderId: string): Promise<VendorWorkOrderView & { vendorName: string }> {
    const w = await prisma.vendorWorkOrder.findFirst({ where: { id: workOrderId, vendorId }, include: { vendor: { select: { name: true } }, adjustments: { orderBy: { createdAt: 'asc' }, select: { kind: true, payableDelta: true, reason: true, createdAt: true } } } });
    if (!w) throw new NotFoundError('VendorWorkOrder', workOrderId);
    return { ...vendorWorkOrderView(w), vendorName: w.vendor.name };
  },

  // The team's view (full money access on the wedding — the route checks). Commission and margin: founder only.
  async forStaff(weddingId: string, workOrderId: string, opts: { seesCommission: boolean }): Promise<StaffWorkOrderView> {
    const w = await prisma.vendorWorkOrder.findFirst({ where: { id: workOrderId, vendorBooking: { weddingEvent: { weddingId } } }, include: { vendor: { select: { name: true } }, adjustments: { orderBy: { createdAt: 'asc' }, select: { kind: true, payableDelta: true, reason: true, createdAt: true } } } });
    if (!w) throw new NotFoundError('VendorWorkOrder', workOrderId);
    return {
      ...vendorWorkOrderView(w),
      pricingModel: w.pricingModel,
      clientPrice: w.clientPrice,
      commissionRate: opts.seesCommission ? w.commissionRate : null,
      commissionAmount: opts.seesCommission ? w.commissionAmount : null,
      margin: opts.seesCommission ? w.margin : null,
      historical: w.historical,
      vendorName: w.vendor.name,
    };
  },
};
