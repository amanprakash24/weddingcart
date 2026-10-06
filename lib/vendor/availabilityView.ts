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
  // row.date is a @db.Date column, serialized by Prisma as an ISO string ("2026-10-15T00:00:00.000Z") —
  // the first 7 characters ("2026-10") are the unambiguous calendar month, straight from the source of
  // truth. Reading it via d.getFullYear()/d.getMonth() (the previous implementation) reinterprets that
  // instant through the server's local timezone, which can bucket a date into the wrong month near a
  // month boundary when the server isn't running in IST (see lib/vendor/todayView.ts for the same class
  // of bug). monthKey is therefore "YYYY-MM" (1-indexed month), not the old 0-indexed getMonth() value.
  const groups = new Map<string, VendorAvailabilityRow[]>();
  for (const row of rows) {
    const key = row.date.slice(0, 7);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  return Array.from(groups.entries())
    .map(([monthKey, entries]) => {
      const [year, month] = monthKey.split('-').map(Number);
      return {
        monthKey,
        // Date.UTC + timeZone: 'UTC' keeps this label construction free of the same local-timezone
        // reinterpretation the monthKey itself was just fixed to avoid.
        monthLabel: new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        entries: [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      };
    })
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}
