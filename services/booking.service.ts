import { bookingRepository } from '@/repositories/booking.repository';
import { vendorRepository } from '@/repositories/vendor.repository';
import type { Prisma } from '@/generated/prisma/client';

export interface BookingItemInput {
  vendorId: string; // legacy naming — actually the vendor's slug, not its id
  vendorName: string;
  vendorCategory: string;
  packageName: string;
  price: number;
  quantity: number;
}

export interface BookingCreateData {
  name: string;
  phone: string;
  city: string;
  total: number;
  items: BookingItemInput[];
}

export const bookingService = {
  async list() {
    return bookingRepository.findMany({ orderBy: { createdAt: 'desc' } });
  },

  getById: bookingRepository.findById,

  // Each item's vendor is resolved by slug independently and degrades
  // gracefully to vendorId: null when it doesn't resolve, rather than
  // failing the whole multi-item checkout — BookingItem.vendorId is optional
  // precisely because the schema and weddingConversion.service.ts already
  // treat an unlinked vendor as a normal, handled case (skipped with a
  // follow-up task on conversion), unlike Enquiry's single required vendor.
  async create(data: BookingCreateData) {
    const items = await Promise.all(
      data.items.map(async (item) => {
        const vendor = await vendorRepository.findBySlug(item.vendorId);
        return {
          vendorName: item.vendorName,
          vendorCategory: item.vendorCategory,
          packageName: item.packageName,
          price: item.price,
          quantity: item.quantity,
          vendor: vendor ? { connect: { id: vendor.id } } : undefined,
        };
      })
    );

    return bookingRepository.create({
      name: data.name,
      phone: data.phone,
      city: data.city,
      total: data.total,
      items: { create: items },
    });
  },

  // Hard boundary: only `status` is ever passed in by the route.
  // weddingDate/weddingType/guestCount and the conversion pipeline
  // (weddingConversion.service.ts) are untouched here.
  update: (id: string, data: Prisma.BookingUpdateInput) => bookingRepository.update(id, data),
};
