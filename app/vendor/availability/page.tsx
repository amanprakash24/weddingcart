import AvailabilityCalendar from '@/components/vendor/availability/AvailabilityCalendar';

// "Availability" in Vendor OS (12 Oct 2026): a month calendar of the business's own booked dates. The screen loads them through
// the venue-scoped API (/api/vendor-os/calendar); this page reads no data itself. It replaced a list of hand-set VendorAvailability
// rows that nothing in the app writes any more, so it was always empty.
export const metadata = {
  title: 'Availability | Vendor OS',
  robots: { index: false, follow: false },
};

export default function VendorAvailabilityPage() {
  return <AvailabilityCalendar />;
}
