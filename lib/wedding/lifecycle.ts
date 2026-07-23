import type { Prisma } from '@/generated/prisma/client';
import type { WeddingStatus } from '@/generated/prisma/enums';
import { weddingRepository } from '@/repositories/wedding.repository';
import { activityLogRepository } from '@/repositories/activityLog.repository';

type Tx = Prisma.TransactionClient;

// domain-model.md §5.2 — PLANNING->ACTIVE is deliberately NOT in this matrix:
// it fires automatically (see maybeActivateWedding below), not via a
// coordinator-picked transition, so there's nothing to manually select it
// with. Everything else here is an explicit coordinator action.
//
// POSTPONED resumes to either PLANNING or ACTIVE (coordinator picks) rather
// than tracking a single "paused from" state — same precedent as ON_HOLD in
// lib/crm/pipeline.ts, since postponement is about the date/plans slipping,
// not about undoing whatever vendor-confirmation progress already happened.
export const WEDDING_STATUS_TRANSITIONS: Record<WeddingStatus, WeddingStatus[]> = {
  PLANNING: ['POSTPONED', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'POSTPONED', 'CANCELLED'],
  POSTPONED: ['PLANNING', 'ACTIVE'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionWedding(from: WeddingStatus, to: WeddingStatus): boolean {
  return WEDDING_STATUS_TRANSITIONS[from].includes(to);
}

// domain-model.md §5.2 — the one automatic transition. Called after any
// VendorBooking on this Wedding reaches CONFIRMED (services/weddingWorkspace
// .service.ts's updateVendorBookingStatus). A no-op unless the Wedding is
// still PLANNING, so it's safe to call unconditionally on every confirmation,
// not just the first.
export async function maybeActivateWedding(weddingId: string, tx: Tx): Promise<void> {
  const wedding = await weddingRepository.findById(weddingId, tx);
  if (!wedding || wedding.status !== 'PLANNING') return;

  await weddingRepository.update(weddingId, { status: 'ACTIVE' }, tx);
  await activityLogRepository.create(
    {
      type: 'STATUS_CHANGED',
      summary: 'Wedding became Active — first vendor booking confirmed',
      wedding: { connect: { id: weddingId } },
    },
    tx
  );
}
