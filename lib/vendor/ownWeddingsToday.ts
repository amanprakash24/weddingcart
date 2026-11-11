// Today counted only the weddings Shaadi Shopping booked this business on (lib/vendor/todayView.ts), so a venue with its own
// confirmed weddings read "0 upcoming weddings" (launch walkthrough, 11 Nov 2026). This adds the business's OWN weddings
// (/api/vendor-os/weddings, loaded in the browser like the Weddings page) to the counts, the lists and the next action.
// Pure: no fetching, no framework.
import type { VendorTodayView } from './todayView';
import type { VenueWeddingListItem } from '@/services/venueWedding.service';

const NOT_ACTIVE = new Set(['COMPLETED', 'CANCELLED', 'POSTPONED']);
const shortDate = (d: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(`${d}T12:00:00+05:30`));
const what = (w: VenueWeddingListItem) => (w.functions.length ? w.functions.join(', ') : 'Wedding');

export type TodayWithOwn = VendorTodayView & { upcomingCount: number };

export function withOwnWeddings(view: VendorTodayView, own: VenueWeddingListItem[] | null): TodayWithOwn {
  const active = (own ?? []).filter((w) => !NOT_ACTIVE.has(w.stage) && w.daysToGo !== null);
  const ownToday = active.filter((w) => w.daysToGo === 0);
  const ownUpcoming = active.filter((w) => (w.daysToGo as number) > 0);

  const todaysServices = [
    ...view.todaysServices,
    ...ownToday.map((w) => ({ id: `own-${w.id}`, wedding: w.customerName, function: what(w), time: '', location: '', status: 'confirmed' as const, href: `/vendor/weddings/${w.id}` })),
  ];
  const upcoming = [
    ...view.upcomingWeddings,
    ...ownUpcoming.map((w) => ({ id: `own-${w.id}`, wedding: w.customerName, date: shortDate(w.date), function: what(w), daysToGo: w.daysToGo as number, href: `/vendor/weddings/${w.id}` })),
  ].sort((a, b) => (a.daysToGo ?? Number.POSITIVE_INFINITY) - (b.daysToGo ?? Number.POSITIVE_INFINITY));

  // Something that needs doing stays first; otherwise the nearest wedding, now including the business's own.
  let nextAction = view.nextAction;
  if (nextAction.tone === 'calm') {
    if (todaysServices.length > 0) {
      const s = todaysServices[0];
      nextAction = { title: `Today: ${s.wedding} — ${s.function}`, detail: [s.time, s.location].filter(Boolean).join(' · ') || undefined, tone: 'calm' };
    } else if (upcoming.length > 0) {
      nextAction = { title: `Next: ${upcoming[0].wedding} — ${upcoming[0].function}`, detail: upcoming[0].date, tone: 'calm' };
    }
  }

  return { ...view, todaysServices, upcomingWeddings: upcoming.slice(0, 6), upcomingCount: upcoming.length, nextAction };
}
