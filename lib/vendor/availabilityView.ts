// Groups a vendor's VendorAvailability rows (from services/venuePortal.service.ts's getDashboard — already
// vendor-scoped, future-only, 90-day window, ordered by date ascending) into month buckets for display.
// Pure: no database, no framework. No "needs attention" bucket here on purpose — unlike bookings, a
// BOOKED or BLOCKED date isn't an actionable problem, just already-set state; inventing an urgency signal
// with nothing in the data to ground it would be fabricating status, which this initiative has avoided
// throughout.
import type { venuePortalService } from '@/services/venuePortal.service';

export type VendorAvailabilityRow = Awaited<ReturnType<typeof venuePortalService.getDashboard>>['availability'][number];

export interface AvailabilityMonthGroup {
  monthKey: string;
  monthLabel: string;
  entries: VendorAvailabilityRow[];
}

export function groupAvailabilityByMonth(rows: VendorAvailabilityRow[]): AvailabilityMonthGroup[] {
  const groups = new Map<string, VendorAvailabilityRow[]>();
  for (const row of rows) {
    const d = new Date(row.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  return Array.from(groups.entries())
    .map(([monthKey, entries]) => {
      const [year, month] = monthKey.split('-').map(Number);
      return {
        monthKey,
        monthLabel: new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
        entries: [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      };
    })
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}
