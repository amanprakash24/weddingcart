import { bookingRepository } from '@/repositories/booking.repository';
import { vendorRepository } from '@/repositories/vendor.repository';
import { NotFoundError } from '@/lib/errors';
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

  // Price is never trusted from the client — same "server computes the
  // amount" rule already applied to payment links/invoices, just never
  // reached this checkout path until now. Each item's real price comes from
  // the vendor's own VendorPackage (matched by name), and the booking total
  // is recomputed from those authoritative prices. An item whose vendor or
  // packageName doesn't resolve to a real VendorPackage rejects the whole
  // booking (NotFoundError, same mechanism every other route in this
  // codebase uses for an unresolvable reference) rather than falling back
  // to the client-supplied price — this replaces the previous graceful
  // degrade-to-unlinked-vendor behavior for that case, since there's no
  // longer a client-supplied price left to fall back to.
  async create(data: BookingCreateData) {
    const items = await Promise.all(
      data.items.map(async (item) => {
        const vendor = await vendorRepository.findBySlug(item.vendorId);
        const vendorPackage = vendor?.packages.find((p) => p.name === item.packageName);
        if (!vendor || !vendorPackage) {
          throw new NotFoundError('VendorPackage', `${item.packageName} (vendor: ${item.vendorId})`);
        }

        return {
          vendorName: item.vendorName,
          vendorCategory: item.vendorCategory,
          packageName: item.packageName,
          price: vendorPackage.price,
          quantity: item.quantity,
          vendor: { connect: { id: vendor.id } },
        };
      })
    );

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return bookingRepository.create({
      name: data.name,
      phone: data.phone,
      city: data.city,
      total,
      items: { create: items },
    });
  },

  // Hard boundary: only `status` is ever passed in by the route.
  // weddingDate/weddingType/guestCount and the conversion pipeline
  // (weddingConversion.service.ts) are untouched here.
  update: (id: string, data: Prisma.BookingUpdateInput) => bookingRepository.update(id, data),
};
