import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { effectiveScope } from '@/lib/ownership/scope';
import { PLATFORM_BUSINESS_ID } from '@/lib/ownership/owned';
import { kindsForCategory, OFFERING_KIND_LABELS, OFFERING_LIMITS, validateOffering, type Catalog, type ListingPackage, type Offering, type OfferingErrors } from '@/lib/venue/offering';

// "What we offer" — a business's ONE price list, by kind (lib/venue/offering.ts). Always called inside the business's scope
// (lib/ownership/venueEntry.ts). BusinessOffering is not an owned table, so EVERY read and write here names the business of the
// current scope itself — never one from a request — and a row of another business is simply "not found".
// The packages on the business's public Shaadi Shopping page (VendorPackage, managed by Shaadi Shopping) are shown beside the
// list and can be copied into it; they are read through the business's own listing only.

export type OfferingResult = Offering[] | { errors: OfferingErrors };

export interface VenueOfferingDeps {
  db: {
    businessOffering: Pick<typeof prisma.businessOffering, 'findMany' | 'count' | 'create' | 'updateMany' | 'deleteMany'>;
    business: Pick<typeof prisma.business, 'findUnique'>;
    vendorPackage: Pick<typeof prisma.vendorPackage, 'findMany'>;
  };
}

const defaultDeps = (): VenueOfferingDeps => ({ db: prisma });

export const OFFERING_SELECT = { id: true, kind: true, function: true, name: true, description: true, price: true, perPlate: true, active: true } as const;
export const OFFERING_ORDER = [{ kind: 'asc' }, { createdAt: 'asc' }] as const;

export function createVenueOfferingService(deps: VenueOfferingDeps = defaultDeps()) {
  // The business this work runs as. Shaadi Shopping has no price list here.
  function businessId(): string {
    const scope = effectiveScope();
    if (scope.kind !== 'BUSINESS' || scope.businessId === PLATFORM_BUSINESS_ID) throw new NotFoundError('Business', 'current');
    return scope.businessId;
  }

  async function list(): Promise<Offering[]> {
    return deps.db.businessOffering.findMany({ where: { businessId: businessId() }, select: OFFERING_SELECT, orderBy: [...OFFERING_ORDER] });
  }

  // The business's public listing, if it has one: its category (which kinds to show first) and its packages there.
  async function listing(id: string): Promise<{ category: string | null; packages: { id: string; name: string; price: number; isPerPlate: boolean }[] }> {
    const business = await deps.db.business.findUnique({ where: { id }, select: { vendorId: true, vendor: { select: { category: { select: { slug: true } } } } } });
    if (!business?.vendorId) return { category: null, packages: [] };
    const packages = await deps.db.vendorPackage.findMany({ where: { vendorId: business.vendorId }, select: { id: true, name: true, price: true, isPerPlate: true }, orderBy: { price: 'asc' }, take: 40 });
    return { category: business.vendor?.category.slug ?? null, packages };
  }

  async function tooMany(id: string, kind: Offering['kind']): Promise<void> {
    if ((await deps.db.businessOffering.count({ where: { businessId: id, kind } })) >= OFFERING_LIMITS.maxPerKind) {
      throw new ConflictError(`Please keep it to ${OFFERING_LIMITS.maxPerKind} under ${OFFERING_KIND_LABELS[kind]}`);
    }
  }

  return {
    list,

    // The whole screen: the list, the kinds to show first, and the packages on the public page.
    async catalog(): Promise<Catalog> {
      const id = businessId();
      const [items, own] = await Promise.all([list(), listing(id)]);
      const copied = new Set((await deps.db.businessOffering.findMany({ where: { businessId: id, sourcePackageId: { not: null } }, select: { sourcePackageId: true } })).map((r) => r.sourcePackageId));
      const listingPackages: ListingPackage[] = own.packages.map((p) => ({ id: p.id, name: p.name, price: p.price, perPlate: p.isPerPlate, copied: copied.has(p.id) }));
      return { items, kinds: kindsForCategory(own.category), listingPackages };
    },

    async create(input: Record<string, unknown>): Promise<OfferingResult> {
      const id = businessId();
      const checked = validateOffering(input);
      if (!checked.ok) return { errors: checked.errors };
      await tooMany(id, checked.value.kind);
      await deps.db.businessOffering.create({ data: { ...checked.value, businessId: id } });
      return list();
    },

    async update(offeringId: string, input: Record<string, unknown>): Promise<OfferingResult> {
      const id = businessId();
      const checked = validateOffering(input);
      if (!checked.ok) return { errors: checked.errors };
      const changed = await deps.db.businessOffering.updateMany({ where: { id: offeringId, businessId: id }, data: checked.value });
      if (changed.count === 0) throw new NotFoundError('Offering', offeringId);
      return list();
    },

    // Offer it / stop offering it, without losing it: a hidden item stays in the list but is not a one-tap line and is not shown
    // to couples.
    async setActive(offeringId: string, active: boolean): Promise<Offering[]> {
      const changed = await deps.db.businessOffering.updateMany({ where: { id: offeringId, businessId: businessId() }, data: { active } });
      if (changed.count === 0) throw new NotFoundError('Offering', offeringId);
      return list();
    },

    // Copy a package from the business's OWN public page into its list, as a package it can then change. Once only.
    async copyListingPackage(packageId: string): Promise<Offering[]> {
      const id = businessId();
      const pkg = (await listing(id)).packages.find((p) => p.id === packageId);
      if (!pkg) throw new NotFoundError('Package', packageId);
      if ((await deps.db.businessOffering.count({ where: { businessId: id, sourcePackageId: pkg.id } })) > 0) throw new ConflictError('This package is already in your list');
      await tooMany(id, 'PACKAGE');
      await deps.db.businessOffering.create({
        data: { businessId: id, kind: 'PACKAGE', function: null, name: pkg.name.trim().slice(0, OFFERING_LIMITS.nameMax), description: null, price: pkg.price, perPlate: pkg.isPerPlate, active: true, sourcePackageId: pkg.id },
      });
      return list();
    },

    async remove(offeringId: string): Promise<Offering[]> {
      const removed = await deps.db.businessOffering.deleteMany({ where: { id: offeringId, businessId: businessId() } });
      if (removed.count === 0) throw new NotFoundError('Offering', offeringId);
      return list();
    },
  };
}

export const venueOfferingService = createVenueOfferingService();
