import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { auditAs } from '@/lib/finance/audit';
import { commissionRateRepository } from '@/repositories/commissionRate.repository';
import { generateWorkOrderNumber } from '@/services/documentNumber.service';
import { buildWorkOrder, checkPricing, vendorWorkOrderView, type PricingInput, type VendorWorkOrderView, type WorkOrderScope } from '@/lib/vendor/workOrder';

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

export interface StaffWorkOrderView extends VendorWorkOrderView {
  pricingModel: 'COMMISSION' | 'FIXED';
  clientPrice: number;
  commissionRate: number | null; // founder only (null otherwise)
  commissionAmount: number | null; // founder only
  margin: number | null; // founder only
  historical: boolean;
  vendorName: string;
}

export const vendorWorkOrderService = {
  // Issue the work order for a confirmed assignment, inside the caller's transaction. Idempotent: an existing one is returned. When it
  // cannot be issued (no rate, no fixed price) the confirmation still goes ahead and the timeline says why — the Money check lists it.
  async issueInTx(tx: Tx, vendorBookingId: string, actorId: string | null, opts: { historical?: boolean } = {}) {
    const existing = await tx.vendorWorkOrder.findUnique({ where: { vendorBookingId } });
    if (existing) return { issued: false as const, workOrder: existing };
    const b = await tx.vendorBooking.findUnique({
      where: { id: vendorBookingId },
      include: {
        vendor: { select: { name: true, categoryId: true, category: { select: { name: true } } } },
        vendorPackage: { select: { name: true, description: true } },
        weddingEvent: { select: { type: true, label: true, date: true, startTime: true, venueName: true, venueAddress: true, city: true, wedding: { select: { id: true, weddingNumber: true, guestCount: true, customer: { select: { name: true } }, couple: { select: { brideName: true, groomName: true } } } } } },
      },
    });
    if (!b) throw new NotFoundError('VendorBooking', vendorBookingId);
    const ev = b.weddingEvent;
    const scope: Omit<WorkOrderScope, 'terms'> = {
      weddingNumber: ev.wedding.weddingNumber,
      coupleName: ev.wedding.customer?.name || [ev.wedding.couple?.brideName, ev.wedding.couple?.groomName].filter(Boolean).join(' & ') || null,
      functionName: ev.label || ev.type.charAt(0) + ev.type.slice(1).toLowerCase().replace(/_/g, ' '),
      functionDate: indiaDay(ev.date),
      startTime: ev.startTime,
      venueName: ev.venueName,
      venueAddress: ev.venueAddress,
      city: ev.city,
      guestCount: ev.wedding.guestCount,
      service: b.vendor.category?.name ?? 'Service',
      packageName: b.vendorPackage?.name ?? null,
      deliverables: b.vendorPackage?.description ?? null,
    };
    const built = buildWorkOrder(
      { id: b.id, status: b.status, venueStatus: b.venueStatus, agreedPrice: b.agreedPrice, currentRate: await rateFor(b.vendor.categoryId, tx), pricingModel: b.pricingModel, vendorPrice: b.vendorPrice, payout: null, payments: [] },
      scope
    );
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
    await tx.activityLog.create({ data: { type: 'STATUS_CHANGED', summary: `Work order ${number} issued to ${b.vendor.name}: ${inr(v.vendorPayable)} for ${scope.functionName}`, wedding: { connect: { id: ev.wedding.id } }, vendorBooking: { connect: { id: b.id } }, ...(actorId ? { performedBy: { connect: { id: actorId } } } : {}) } });
    return { issued: true as const, workOrder };
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
    const w = await prisma.vendorWorkOrder.findFirst({ where: { id: workOrderId, vendorId }, include: { vendor: { select: { name: true } } } });
    if (!w) throw new NotFoundError('VendorWorkOrder', workOrderId);
    return { ...vendorWorkOrderView(w), vendorName: w.vendor.name };
  },

  // The team's view (full money access on the wedding — the route checks). Commission and margin: founder only.
  async forStaff(weddingId: string, workOrderId: string, opts: { seesCommission: boolean }): Promise<StaffWorkOrderView> {
    const w = await prisma.vendorWorkOrder.findFirst({ where: { id: workOrderId, vendorBooking: { weddingEvent: { weddingId } } }, include: { vendor: { select: { name: true } } } });
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
