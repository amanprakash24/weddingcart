import { vendorRepository } from '@/repositories/vendor.repository';
import { categoryRepository } from '@/repositories/category.repository';
import { enquiryRepository } from '@/repositories/enquiry.repository';
import { consultationRepository } from '@/repositories/consultation.repository';
import { bookingRepository } from '@/repositories/booking.repository';
import { vendorApplicationRepository } from '@/repositories/vendorApplication.repository';
import { leadRepository } from '@/repositories/lead.repository';

// Cross-repository composition for the admin dashboard's summary counts —
// mirrors the old Mongo route's 12 queries exactly, field for field,
// including the outsideVendors/newOutsideVendors naming (actually
// VendorApplication counts — AdminClient.tsx's tab is literally labeled
// "Outside Vendors" for vendor applications) and revenue counting both
// CONFIRMED and CLOSED bookings, not just CONFIRMED.
//
// Deliberately sequential (await one at a time), not Promise.all —
// production-integrity finding: this endpoint is one of 9 requests fired
// simultaneously by AdminClient.tsx's fetchAll() on every Dashboard load,
// and running all 12 of these queries concurrently made it by far the
// single heaviest contributor to contention against the shared,
// intentionally-capped (max: 3) Postgres connection pool
// (lib/prismaPoolConfig.ts) — intermittently exhausting it and causing this
// route to fail outright, which the Dashboard's StatsState previously
// surfaced as the six summary cards silently falling back to 0 (now fixed
// separately at the UI layer — see components/AdminClient.tsx). Trades
// some latency (12 sequential round trips instead of 12 concurrent ones)
// for reliability — an acceptable trade for an admin-only, infrequently
// -loaded summary. Not touching fetchAll()'s own 9-way burst or the pool
// size itself, per the agreed scope — this is the smallest change that
// removes this route's own worst-case simultaneous-connection demand.
export const statsService = {
  async get() {
    const vendors = await vendorRepository.count();
    const categories = await categoryRepository.count();
    const enquiries = await enquiryRepository.count();
    const consultations = await consultationRepository.count();
    const newEnquiries = await enquiryRepository.count({ status: 'NEW' });
    const newConsultations = await consultationRepository.count({ status: 'NEW' });
    const bookings = await bookingRepository.count();
    const newBookings = await bookingRepository.count({ status: 'NEW' });
    const outsideVendors = await vendorApplicationRepository.count();
    const newOutsideVendors = await vendorApplicationRepository.count({ status: 'NEW' });
    const leads = await leadRepository.count();
    const revenue = await bookingRepository.sumTotal({ status: { in: ['CONFIRMED', 'CLOSED'] } });

    return {
      vendors, categories, enquiries, consultations,
      newEnquiries, newConsultations, bookings, newBookings,
      outsideVendors, newOutsideVendors, leads, revenue,
    };
  },
};
