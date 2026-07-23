import type { WeddingStatus, TaskStatus, VendorBookingStatus } from '@/generated/prisma/enums';

// Milestone 6, scoped to the 3 inputs actually asked for — not the full
// 5-input formula docs/wedding-os/03-wedding-workspace.md §10 sketched
// (payment status + timeline adherence need the Invoice/Payment<->Wedding
// link that Sprint 5.4 already flagged as not real yet on the CRM path).
// Deterministic, computed on read, never stored — same pattern as
// lib/crm/pipeline.ts's transition matrix.
export type WeddingHealth = 'HEALTHY' | 'AT_RISK' | 'OVERDUE';

// How close to a vendor booking's event date an unconfirmed booking counts as
// urgent. A placeholder threshold, same category as leadInboxService's 24h
// overdue-lead proxy — adjust if it proves too tight/loose in practice.
const VENDOR_CONFIRMATION_URGENCY_DAYS = 14;

export function computeWeddingHealth(params: {
  status: WeddingStatus;
  tasks: { status: TaskStatus; dueAt: Date | null }[];
  vendorBookings: { status: VendorBookingStatus; eventDate: Date }[];
  now?: Date;
}): WeddingHealth {
  const now = params.now ?? new Date();

  if (params.status === 'POSTPONED') return 'OVERDUE';

  const hasOverdueTask = params.tasks.some(
    (t) => t.dueAt !== null && t.dueAt < now && t.status !== 'DONE' && t.status !== 'CANCELLED'
  );
  if (hasOverdueTask) return 'OVERDUE';

  const urgencyMs = VENDOR_CONFIRMATION_URGENCY_DAYS * 24 * 60 * 60 * 1000;
  const hasUrgentUnconfirmedVendor = params.vendorBookings.some(
    (vb) => vb.status === 'PENDING_VENDOR_CONFIRMATION' && vb.eventDate.getTime() - now.getTime() <= urgencyMs
  );
  if (hasUrgentUnconfirmedVendor) return 'AT_RISK';

  return 'HEALTHY';
}

export const HEALTH_LABELS: Record<WeddingHealth, string> = {
  HEALTHY: 'Healthy',
  AT_RISK: 'At Risk',
  OVERDUE: 'Overdue',
};

export const HEALTH_COLORS: Record<WeddingHealth, string> = {
  HEALTHY: 'bg-emerald-100 text-emerald-700',
  AT_RISK: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-red-100 text-red-700',
};
