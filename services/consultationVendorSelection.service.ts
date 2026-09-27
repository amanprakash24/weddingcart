import { prisma } from '@/lib/prisma';
import { categoryRepository } from '@/repositories/category.repository';
import { consultationRepository } from '@/repositories/consultation.repository';
import { consultationVendorSelectionRepository } from '@/repositories/consultationVendorSelection.repository';
import { ValidationError, NotFoundError } from '@/lib/errors';

function normalizeServiceKey(serviceKey: string): string {
  return serviceKey.trim().toLowerCase();
}

async function findConsultation(id: string) {
  const consultation = await consultationRepository.findById(id);
  if (!consultation) throw new NotFoundError('Consultation', id);
  return consultation;
}

async function validateService(consultationId: string, serviceKey: string): Promise<{ consultationId: string; serviceKey: string }> {
  const consultation = await findConsultation(consultationId);
  const normalized = normalizeServiceKey(serviceKey);
  const services = consultation.services.map(normalizeServiceKey);
  if (!services.includes(normalized)) {
    throw new ValidationError(`Service "${serviceKey}" is not required by this consultation`);
  }
  return { consultationId, serviceKey: normalized };
}

export const consultationVendorSelectionService = {
  list: async (consultationId: string) => {
    await findConsultation(consultationId);
    return consultationVendorSelectionRepository.findMany(consultationId);
  },

  select: async ({
    consultationId,
    serviceKey,
    categoryId,
    vendorId,
  }: {
    consultationId: string;
    serviceKey: string;
    categoryId?: string;
    vendorId: string;
  }) => {
    const normalized = await validateService(consultationId, serviceKey);
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, categoryId: true, status: true },
    });
    if (!vendor) throw new NotFoundError('Vendor', vendorId);
    if (vendor.status !== 'PUBLISHED') {
      throw new ValidationError('Selected vendor is not published and cannot be selected');
    }

    if (categoryId) {
      const category = await categoryRepository.findById(categoryId);
      if (!category) throw new NotFoundError('Category', categoryId);
      if (vendor.categoryId !== category.id) {
        throw new ValidationError('Selected category does not match the vendor');
      }
    }

    return consultationVendorSelectionRepository.upsert(
      {
        consultation: { connect: { id: normalized.consultationId } },
        serviceKey: normalized.serviceKey,
        category: categoryId ? { connect: { id: categoryId } } : undefined,
        vendor: { connect: { id: vendor.id } },
      },
      { consultationId_serviceKey: { consultationId: normalized.consultationId, serviceKey: normalized.serviceKey } },
      {
        category: categoryId ? { connect: { id: categoryId } } : { disconnect: true },
        vendor: { connect: { id: vendor.id } },
      }
    );
  },

  remove: async (consultationId: string, serviceKey: string) => {
    const normalized = await validateService(consultationId, serviceKey);
    return consultationVendorSelectionRepository.delete({
      consultationId_serviceKey: { consultationId: normalized.consultationId, serviceKey: normalized.serviceKey },
    });
  },
};
