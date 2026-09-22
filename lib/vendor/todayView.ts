// Same source data as weddingsView.ts/servicesView.ts (venuePortalService.getDashboard, already vendor-
// scoped) reshaped for the Vendor -> Today screen's specific sections (stats, next action, needs attention,
// today's services, upcoming weddings, pending responses, recent activity). Pure: no database, no
// framework. This is the first time Today has been built from real data — it previously shipped as a
// static mock spec-proof (docs/wedding-os/11-vivah-os-ux-architecture.md §1) with no page wired to it.
import { isOverdue, type VendorBookingRow } from './weddingsView';

export interface VendorTodayView {
  nextAction: { title: string; detail?: string; tone: 'calm' | 'attention' };
  attentionItems: { id: string; title: string; meta: string }[];
  todaysServices: { id: string; wedding: string; function: string; time: string; location: string; status: 'confirmed' | 'pending' }[];
  upcomingWeddings: { id: string; wedding: string; date: string; function: string }[];
  pendingResponses: { id: string; wedding: string; function: string; requirement: string; price: string }[];
  recentActivity: { id: string; text: string; when: string }[];
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function timeAgo(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function buildVendorTodayView(bookings: VendorBookingRow[], isVenue = false): VendorTodayView {
  const now = Date.now();
  const todayKey = new Date().toISOString().slice(0, 10);
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

  const awaitingResponse = bookings.filter((b) => b.bookingStatus === 'PENDING_VENDOR_CONFIRMATION');
  const overdueByBooking = bookings
    .map((b) => ({ booking: b, task: b.tasks.find((t) => isOverdue(t.dueAt, t.status)) }))
    .filter((x): x is { booking: VendorBookingRow; task: NonNullable<(typeof x)['task']> } => Boolean(x.task));

  // Venue Owner specialization (docs/wedding-os/11-vivah-os-ux-architecture.md §3/§20): a venue whose
  // setup isn't READY yet for an event happening today or within 2 days is a real operational risk, not
  // just informational — surfaced as its own attention item.
  const setupAtRisk = isVenue
    ? bookings.filter((b) => {
        const eventTime = new Date(b.event.date).getTime();
        const isImminent = eventTime - now <= twoDaysMs && eventTime - now > -24 * 60 * 60 * 1000;
        const notReady = b.venueStatus !== 'READY' && b.venueStatus !== 'COMPLETED';
        const isLive = b.bookingStatus === 'CONFIRMED' || b.bookingStatus === 'COMPLETED';
        return isImminent && notReady && isLive;
      })
    : [];

  const attentionItems = [
    ...awaitingResponse.map((b) => ({ id: `resp-${b.id}`, title: `Respond to booking request — ${b.event.name}`, meta: `${b.event.function} · ${dateLabel(b.event.date)}` })),
    ...overdueByBooking.map(({ booking, task }) => ({ id: `task-${task.id}`, title: `${task.title} — ${booking.event.name}`, meta: `${booking.event.function} overdue` })),
    ...setupAtRisk.map((b) => ({ id: `setup-${b.id}`, title: `Setup not ready — ${b.event.name}`, meta: `${b.event.function} on ${dateLabel(b.event.date)}` })),
  ];

  const todaysServices = bookings
    .filter((b) => b.event.date.slice(0, 10) === todayKey)
    .map((b) => ({
      id: b.id,
      wedding: b.event.name,
      function: b.event.function,
      time: b.event.startTime ?? '',
      location: b.event.venueName || b.event.city,
      status: (b.bookingStatus === 'CONFIRMED' || b.bookingStatus === 'COMPLETED' ? 'confirmed' : 'pending') as 'confirmed' | 'pending',
    }));

  const upcomingWeddings = bookings
    .filter((b) => new Date(b.event.date).getTime() > now && b.event.date.slice(0, 10) !== todayKey && b.bookingStatus === 'CONFIRMED')
    .sort((a, b) => new Date(a.event.date).getTime() - new Date(b.event.date).getTime())
    .slice(0, 6)
    .map((b) => ({ id: b.id, wedding: b.event.name, date: dateLabel(b.event.date), function: b.event.function }));

  const pendingResponses = awaitingResponse.map((b) => ({
    id: b.id,
    wedding: b.event.name,
    function: b.event.function,
    requirement: b.requirements?.name ?? b.event.function,
    price: `₹${b.amount.toLocaleString('en-IN')}`,
  }));

  // Derived from the vendor's own accept/decline timestamp — the only "activity" signal already available
  // without a new query (no ActivityLog feed is fetched here; see docs §21 for what a real feed would need).
  const recentActivity = bookings
    .filter((b) => b.respondedAt && (b.bookingStatus === 'CONFIRMED' || b.bookingStatus === 'DECLINED'))
    .sort((a, b) => new Date(b.respondedAt as string).getTime() - new Date(a.respondedAt as string).getTime())
    .slice(0, 5)
    .map((b) => ({
      id: b.id,
      text: `${b.bookingStatus === 'CONFIRMED' ? 'Confirmed' : 'Declined'} for ${b.event.function} — ${b.event.name}`,
      when: timeAgo(b.respondedAt as string),
    }));

  let nextAction: VendorTodayView['nextAction'];
  if (awaitingResponse.length > 0) {
    nextAction = { title: `Respond to booking request — ${awaitingResponse[0].event.name}`, detail: `${awaitingResponse[0].event.function} · ${dateLabel(awaitingResponse[0].event.date)}`, tone: 'attention' };
  } else if (setupAtRisk.length > 0) {
    nextAction = { title: `Setup not ready — ${setupAtRisk[0].event.name}`, detail: `${setupAtRisk[0].event.function} on ${dateLabel(setupAtRisk[0].event.date)}`, tone: 'attention' };
  } else if (overdueByBooking.length > 0) {
    nextAction = { title: `${overdueByBooking[0].task.title} — ${overdueByBooking[0].booking.event.name}`, detail: `${overdueByBooking[0].booking.event.function} is overdue`, tone: 'attention' };
  } else if (todaysServices.length > 0) {
    nextAction = { title: `Today: ${todaysServices[0].wedding} — ${todaysServices[0].function}`, detail: todaysServices[0].time ? `${todaysServices[0].time} · ${todaysServices[0].location}` : todaysServices[0].location, tone: 'calm' };
  } else if (upcomingWeddings.length > 0) {
    nextAction = { title: `Next: ${upcomingWeddings[0].wedding} — ${upcomingWeddings[0].function}`, detail: upcomingWeddings[0].date, tone: 'calm' };
  } else {
    nextAction = { title: 'Nothing needs your attention right now', tone: 'calm' };
  }

  return { nextAction, attentionItems, todaysServices, upcomingWeddings, pendingResponses, recentActivity };
}
