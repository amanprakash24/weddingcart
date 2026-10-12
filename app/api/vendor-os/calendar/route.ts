import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueCalendarService } from '@/services/venueCalendar.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET /api/vendor-os/calendar — "Availability": the business's own booked dates, this month and the next eleven. Venue-scoped. It
// names the couples, so it needs the right to see enquiries or weddings — the same people who see those bookings elsewhere.
async function handleGET() {
  try {
    return NextResponse.json({ success: true, data: await venueCalendarService.get() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, ['enquiries', 'weddings']);
