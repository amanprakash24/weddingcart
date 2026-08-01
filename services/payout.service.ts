import { prisma } from '@/lib/prisma';
import { ActivityType } from '@/generated/prisma/client';
import type { Payout, Prisma } from '@/generated/prisma/client';
import { vendorBookingRepository } from '@/repositories/vendorBooking.repository';
import { weddingEventRepository } from '@/repositories/weddingEvent.repository';
import { weddingRepository } from '@/repositories/wedding.repository';
import { payoutRepository } from '@/repositories/payout.repository';
import { commissionRateRepository } from '@/repositories/commissionRate.repository';
import { activityLogRepository } from '@/repositories/activityLog.repository';
import { NotFoundError, InvalidTransitionError } from '@/lib/errors';

// Sprint 7.3 — tracking only. PROCESSING/FAILED are modeled in PayoutStatus
// but deliberately unused this sprint: no payout-gateway integration exists
// to produce either state. PENDING -> PAID is the only real transition.

async function findVendorBookingInWedding(weddingId: string, vendorBookingId: string) {
  const vendorBooking = await vendorBookingRepository.findById(vendorBookingId);
  if (!vendorBooking) throw new NotFoundError('VendorBooking', vendorBookingId);
  const event = await weddingEventRepository.findById(vendorBooking.weddingEventId);
  if (!event || event.weddingId !== weddingId) throw new NotFoundError('VendorBooking', vendorBookingId);
  return vendorBooking;
}

export const payoutService = {
  async calculatePayoutForBooking(weddingId: string, vendorBookingId: string, actorId: string | null): Promise<Payout> {
    const vendorBooking = await findVendorBookingInWedding(weddingId, vendorBookingId);

    const wedding = await weddingRepository.findById(weddingId);
    if (!wedding) throw new NotFoundError('Wedding', weddingId);
    if (wedding.status === 'CANCELLED') {
      throw new InvalidTransitionError('Cannot calculate payout for a cancelled wedding');
    }

    if (vendorBooking.status !== 'COMPLETED') {
      throw new InvalidTransitionError(`Cannot calculate payout for a booking in status ${vendorBooking.status}`);
    }

    const { data: existingPayouts } = await payoutRepository.findMany({ where: { vendorBookingId } });
    if (existingPayouts.length > 0) {
      throw new InvalidTransitionError('Payout already calculated for this booking');
    }

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorBooking.vendorId }, select: { categoryId: true } });
    if (!vendor) throw new NotFoundError('Vendor', vendorBooking.vendorId);

    const rate = await commissionRateRepository.findCurrentRate(vendor.categoryId);

    const grossAmount = vendorBooking.agreedPrice;
    const commissionAmount = Math.round((grossAmount * rate.rate) / 100);
    const netAmount = grossAmount - commissionAmount;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const payout = await payoutRepository.create(
        {
          vendorBooking: { connect: { id: vendorBookingId } },
          vendor: { connect: { id: vendorBooking.vendorId } },
          grossAmount,
          commissionRate: rate.rate,
          commissionAmount,
          netAmount,
          status: 'PENDING',
        },
        tx
      );

      await activityLogRepository.create(
        {
          type: ActivityType.STATUS_CHANGED,
          summary: `Payout calculated: ₹${netAmount.toLocaleString('en-IN')} net (₹${commissionAmount.toLocaleString('en-IN')} commission @ ${rate.rate}%)`,
          wedding: { connect: { id: weddingId } },
          vendorBooking: { connect: { id: vendorBookingId } },
          performedBy: actorId ? { connect: { id: actorId } } : undefined,
        },
        tx
      );

      return payout;
    });
  },

  async markPayoutPaid(weddingId: string, payoutId: string, actorId: string | null): Promise<Payout> {
    const payout = await payoutRepository.findById(payoutId);
    if (!payout) throw new NotFoundError('Payout', payoutId);

    await findVendorBookingInWedding(weddingId, payout.vendorBookingId);

    if (payout.status !== 'PENDING') {
      throw new InvalidTransitionError(`Cannot mark payout paid from status ${payout.status}`);
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await payoutRepository.update(payoutId, { status: 'PAID', paidAt: new Date() }, tx);

      await activityLogRepository.create(
        {
          type: ActivityType.STATUS_CHANGED,
          summary: `Payout marked paid: ₹${payout.netAmount.toLocaleString('en-IN')}`,
          wedding: { connect: { id: weddingId } },
          vendorBooking: { connect: { id: payout.vendorBookingId } },
          performedBy: actorId ? { connect: { id: actorId } } : undefined,
        },
        tx
      );

      return updated;
    });
  },
};
