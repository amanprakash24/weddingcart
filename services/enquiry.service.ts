import { enquiryRepository } from '@/repositories/enquiry.repository';
import { vendorRepository } from '@/repositories/vendor.repository';
import { NotFoundError } from '@/lib/errors';
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
    });
  },

  // Hard boundary: only `status` (the legacy tri-state field) is ever passed
  // in by the route. pipelineStage/assignedTo/tasks/activities/wedding are
  // the CRM's own fields, owned exclusively by leadWorkspaceService's
  // controlled state machine — never touched here.
  update: (id: string, data: Prisma.EnquiryUpdateInput) => enquiryRepository.update(id, data),

  delete: (id: string) => enquiryRepository.delete(id),
};
