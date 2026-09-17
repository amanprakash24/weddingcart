import { enquiryRepository } from '@/repositories/enquiry.repository';
import { vendorRepository } from '@/repositories/vendor.repository';
import { bookingRepository } from '@/repositories/booking.repository';
import { findWeddingForSource } from '@/services/weddingConversion.service';
import { NotFoundError, ConversionLockedError, InvalidTransitionError } from '@/lib/errors';
import type { Prisma, EnquiryStatus } from '@/generated/prisma/client';

export interface EnquiryCreateData {
  vendorId: string; // legacy naming from Mongo — actually the vendor's slug, not its id
  vendorName: string;
  vendorCategory: string;
  name: string;
  phone: string;
  email?: string;
  city: string;
  eventDate: string;
  guestCount?: string;
  eventType: string;
  message?: string;
  consultationId?: string;
}

export const enquiryService = {
  async list(params: { status?: EnquiryStatus }) {
    return enquiryRepository.findMany({
      where: params.status ? { status: params.status } : {},
      orderBy: { createdAt: 'desc' },
    });
  },

  // Public vendor pages (still Mongo-backed themselves) submit the vendor's
  // slug in a field literally named `vendorId` — a naming leftover from Mongo
  // where the human-readable id and slug were the same field. Pre-checking
  // existence here (rather than letting Prisma's nested connect fail) gives a
  // clean, accurate 404 instead of a generic nested-connect error — same
  // pattern as the Vendor.category fix (PR #37). vendorName/vendorCategory
  // are preserved as submitted, not derived from the Vendor/Category
  // relations — this migration doesn't change that.
  async create(data: EnquiryCreateData) {
    const vendor = await vendorRepository.findBySlug(data.vendorId);
    if (!vendor) throw new NotFoundError('Vendor', data.vendorId);

    return enquiryRepository.create({
      vendor: { connect: { slug: data.vendorId } },
      vendorName: data.vendorName,
      vendorCategory: data.vendorCategory,
      name: data.name,
      phone: data.phone,
      email: data.email,
      city: data.city,
      eventDate: data.eventDate,
      guestCount: data.guestCount,
      eventType: data.eventType,
      message: data.message,
      // Consultation -> Enquiry bridge — relation connect (never a raw
      // scalar), same pattern as bookingService.create()'s enquiryId/
      // consultationId handling.
      consultation: data.consultationId ? { connect: { id: data.consultationId } } : undefined,
    });
  },

  // Hard boundary: only `status` (the legacy tri-state field) is ever passed
  // in by the route. pipelineStage/assignedTo/tasks/activities/wedding are
  // the CRM's own fields, owned exclusively by leadWorkspaceService's
  // controlled state machine — never touched here.
  update: (id: string, data: Prisma.EnquiryUpdateInput) => enquiryRepository.update(id, data),

  // Production-integrity fix: Wedding.sourceEnquiryId and Booking.enquiryId
  // are both optional, unguarded relations — Prisma's default onDelete for
  // those is SetNull (confirmed against the actual migration SQL), so
  // without this check a delete would silently sever either link instead of
  // being refused. That's the exact hole services/lead.service.ts's delete()
  // already closes for Lead; this applies the same pattern here, plus the
  // linked-Booking check Lead doesn't need (Lead has no bookings relation).
  //
  // Order matters: an already-converted Enquiry is checked first (the surer,
  // already-happened case) before the merely-linked-Booking case (a Booking
  // that hasn't converted yet, but would silently lose its cross-path check
  // on a later confirm if this Enquiry disappeared first) — evaluateEnquiryDeleteGuard
  // encodes that priority; short-circuiting the count() query here (only run
  // when no Wedding was found) is just an efficiency detail on top of it.
  async delete(id: string) {
    const wedding = await findWeddingForSource('ENQUIRY', id);
    const linkedBookings = wedding ? 0 : await bookingRepository.count({ enquiryId: id });
    const blocked = evaluateEnquiryDeleteGuard(wedding, linkedBookings);
    if (blocked) throw blocked;
    return enquiryRepository.delete(id);
  },
};

// Pure decision behind delete()'s guard, extracted so the exact rule — block
// on an existing Wedding first, then on any linked Booking, otherwise allow —
// is directly testable without mocking prisma/repositories/weddingConversion
// .service (mock.module() intercepts by resolved file path, so mocking any
// of those here would also hijack other test files' own real usage of the
// same modules; see services/enquiry.service.test.ts).
export function evaluateEnquiryDeleteGuard(
  wedding: { weddingNumber: string } | null,
  linkedBookingCount: number
): Error | null {
  if (wedding) {
    return new ConversionLockedError(`Cannot delete: this enquiry converted to Wedding ${wedding.weddingNumber}`);
  }
  if (linkedBookingCount > 0) {
    return new InvalidTransitionError(`Cannot delete: this enquiry has ${linkedBookingCount} linked booking(s)`);
  }
  return null;
}
