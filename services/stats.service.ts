import { vendorRepository } from '@/repositories/vendor.repository';
import { categoryRepository } from '@/repositories/category.repository';
import { enquiryRepository } from '@/repositories/enquiry.repository';
import { consultationRepository } from '@/repositories/consultation.repository';
import { bookingRepository } from '@/repositories/booking.repository';
import { vendorApplicationRepository } from '@/repositories/vendorApplication.repository';
import { leadRepository } from '@/repositories/lead.repository';

// Cross-repository composition for the admin dashboard's summary counts —
// mirrors the old Mongo route's 12 parallel queries exactly, field for
// field, including the outsideVendors/newOutsideVendors naming (actually
// VendorApplication counts — AdminClient.tsx's tab is literally labeled
// "Outside Vendors" for vendor applications) and revenue counting both
// CONFIRMED and CLOSED bookings, not just CONFIRMED.
export const statsService = {
  async get() {
    const [
      vendors,
      categories,
      enquiries,
      consultations,
      newEnquiries,
      newConsultations,
      bookings,
      newBookings,
      outsideVendors,
      newOutsideVendors,
      leads,
      revenue,
    ] = await Promise.all([
      vendorRepository.count(),
      categoryRepository.count(),
      enquiryRepository.count(),
      consultationRepository.count(),
      enquiryRepository.count({ status: 'NEW' }),
      consultationRepository.count({ status: 'NEW' }),
      bookingRepository.count(),
      bookingRepository.count({ status: 'NEW' }),
      vendorApplicationRepository.count(),
      vendorApplicationRepository.count({ status: 'NEW' }),
      leadRepository.count(),
      bookingRepository.sumTotal({ status: { in: ['CONFIRMED', 'CLOSED'] } }),
    ]);

    return {
      vendors, categories, enquiries, consultations,
      newEnquiries, newConsultations, bookings, newBookings,
      outsideVendors, newOutsideVendors, leads, revenue,
    };
  },
};
