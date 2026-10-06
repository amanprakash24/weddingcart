import { prisma } from '@/lib/prisma';
import type { Scope } from '@/lib/ownership/scope';

// The venue's own business in Vivah OS (docs/wedding-os/15-record-ownership.md §4.1–4.2). A vendor login is tied to its vendor
// (VendorProfile); the first time it works on its OWN records, that vendor gets its Business (kind VENDOR) with the login as Owner.
// Commercial status stays empty until Shaadi Shopping sets it (Phase E). Business and BusinessMember are not owned tables, so this
// runs without a scope. Never takes a business id from a request.

export interface VenueBusinessDeps {
  db: {
    vendorProfile: Pick<typeof prisma.vendorProfile, 'findUnique'>;
    business: Pick<typeof prisma.business, 'findUnique' | 'create'>;
    businessMember: Pick<typeof prisma.businessMember, 'findUnique' | 'create'>;
  };
}

const defaultDeps = (): VenueBusinessDeps => ({ db: prisma });

const isUniqueViolation = (err: unknown) => (err as { code?: string })?.code === 'P2002';

export function createVenueBusinessService(deps: VenueBusinessDeps = defaultDeps()) {
  return {
    // The scope a vendor login works in for its own records; null when the login is not tied to a vendor.
    async scopeForVendorLogin(userId: string): Promise<Extract<Scope, { kind: 'BUSINESS' }> | null> {
      const profile = await deps.db.vendorProfile.findUnique({ where: { userId }, select: { vendorId: true, vendor: { select: { name: true } } } });
      if (!profile) return null;
      let business = await deps.db.business.findUnique({ where: { vendorId: profile.vendorId }, select: { id: true, kind: true } });
      if (!business) {
        try {
          business = await deps.db.business.create({ data: { name: profile.vendor.name, kind: 'VENDOR', vendorId: profile.vendorId }, select: { id: true, kind: true } });
        } catch (err) {
          if (!isUniqueViolation(err)) throw err; // two first requests at once: the other one created it
          business = await deps.db.business.findUnique({ where: { vendorId: profile.vendorId }, select: { id: true, kind: true } });
        }
      }
      if (!business || business.kind !== 'VENDOR') return null;
      let member = await deps.db.businessMember.findUnique({ where: { businessId_userId: { businessId: business.id, userId } }, select: { role: true } });
      if (!member) {
        try {
          member = await deps.db.businessMember.create({ data: { businessId: business.id, userId, role: 'OWNER' }, select: { role: true } });
        } catch (err) {
          if (!isUniqueViolation(err)) throw err;
          member = await deps.db.businessMember.findUnique({ where: { businessId_userId: { businessId: business.id, userId } }, select: { role: true } });
        }
      }
      if (!member) return null;
      return { kind: 'BUSINESS', businessId: business.id, role: member.role };
    },
  };
}

export const venueBusinessService = createVenueBusinessService();
