import { vendorProspectRepository } from '@/repositories/vendorProspect.repository';
import { prisma } from '@/lib/prisma';
import type { VendorProspectStatus } from '@/generated/prisma/client';

export interface VendorProspectImportRow {
  name: string;
  area?: string | null;
  fullAddress?: string | null;
  city: string;
  phone: string;
  email?: string | null;
  contactPerson?: string | null;
  seatingCapacity?: number | null;
  maxCapacity?: number | null;
  priceVegPerPlate?: number | null;
  priceNonVegPerPlate?: number | null;
  venueType?: string | null;
  source: string;
  sourceUrl?: string | null;
}

export const vendorProspectService = {
  async list(params: { status?: VendorProspectStatus; city?: string; search?: string; skip?: number; take?: number }) {
    const { status, city, search, skip, take } = params;
    return vendorProspectRepository.findMany({
      where: {
        status,
        city: city || undefined,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { area: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  },

  getById: vendorProspectRepository.findById,

  // Any status is reachable from any other — this is a lightweight sales-outreach tracker (same posture
  // as BookingStatus/EnquiryStatus elsewhere: NEW/CONTACTED/... updated directly), not a workflow with
  // financial or booking consequences that would justify a guarded transition matrix. Calling this at all
  // means a real contact/update just happened, so lastContactedAt is stamped on every non-NEW status.
  async updateStatus(id: string, status: VendorProspectStatus, notes?: string) {
    const existing = await vendorProspectRepository.findById(id);
    if (!existing) return null;
    return vendorProspectRepository.update(id, {
      status,
      notes: notes !== undefined ? notes : undefined,
      lastContactedAt: status !== 'NEW' ? new Date() : existing.lastContactedAt,
    });
  },

  // One-time bulk import (run from a script, not a UI upload — see docs/wedding-os/12-vendor-prospects.md).
  // Two safety properties, both required because the source data is a competitor scrape run more than
  // once could otherwise duplicate: (1) skips any row whose exact (name, phone) pair already exists in
  // vendor_prospects, so re-running an import is a no-op for rows already loaded; (2) any row whose phone
  // exactly matches an existing ShaadiShopping Vendor.ownerPhone is imported as ALREADY_LISTED, not NEW,
  // so it never shows up as something to cold-call.
  async importRows(rows: VendorProspectImportRow[]) {
    const phones = [...new Set(rows.map((r) => r.phone).filter(Boolean))];
    const [existingVendorPhones, existingProspects] = await Promise.all([
      prisma.vendor.findMany({ where: { ownerPhone: { in: phones } }, select: { ownerPhone: true } }),
      prisma.vendorProspect.findMany({ select: { name: true, phone: true } }),
    ]);
    const listedPhones = new Set(existingVendorPhones.map((v) => v.ownerPhone));
    const existingKeys = new Set(existingProspects.map((p) => `${p.name}::${p.phone}`));

    const toCreate = rows
      .filter((r) => !existingKeys.has(`${r.name}::${r.phone}`))
      .map((r) => ({
        name: r.name,
        area: r.area ?? null,
        fullAddress: r.fullAddress ?? null,
        city: r.city,
        phone: r.phone,
        email: r.email ?? null,
        contactPerson: r.contactPerson ?? null,
        seatingCapacity: r.seatingCapacity ?? null,
        maxCapacity: r.maxCapacity ?? null,
        priceVegPerPlate: r.priceVegPerPlate ?? null,
        priceNonVegPerPlate: r.priceNonVegPerPlate ?? null,
        venueType: r.venueType ?? null,
        source: r.source,
        sourceUrl: r.sourceUrl ?? null,
        status: (listedPhones.has(r.phone) ? 'ALREADY_LISTED' : 'NEW') as VendorProspectStatus,
      }));

    if (toCreate.length === 0) return { created: 0, skipped: rows.length };
    const result = await vendorProspectRepository.createMany(toCreate);
    return { created: result.count, skipped: rows.length - result.count };
  },
};
