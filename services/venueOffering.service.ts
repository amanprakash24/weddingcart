import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { effectiveScope } from '@/lib/ownership/scope';
import { PLATFORM_BUSINESS_ID } from '@/lib/ownership/owned';
import { OFFERING_LIMITS, validateOffering, type Offering, type OfferingErrors } from '@/lib/venue/offering';

// What a venue offers for each wedding function (Phase C) — its own price list. Always called inside the venue's scope
// (lib/ownership/venueEntry.ts). BusinessOffering is not an owned table, so EVERY read and write here names the business of the
// current scope itself — never one from a request — and a row of another business is simply "not found".

export type OfferingResult = Offering[] | { errors: OfferingErrors };

export interface VenueOfferingDeps {
  db: { businessOffering: Pick<typeof prisma.businessOffering, 'findMany' | 'count' | 'create' | 'updateMany' | 'deleteMany'> };
}

const defaultDeps = (): VenueOfferingDeps => ({ db: prisma });

const select = { id: true, function: true, name: true, price: true, perPlate: true } as const;

export function createVenueOfferingService(deps: VenueOfferingDeps = defaultDeps()) {
  // The venue this work runs as. Shaadi Shopping has no price list here.
  function businessId(): string {
    const scope = effectiveScope();
    if (scope.kind !== 'BUSINESS' || scope.businessId === PLATFORM_BUSINESS_ID) throw new NotFoundError('Business', 'current');
    return scope.businessId;
  }

  async function list(): Promise<Offering[]> {
    return deps.db.businessOffering.findMany({ where: { businessId: businessId() }, select, orderBy: [{ function: 'asc' }, { createdAt: 'asc' }] });
  }

  return {
    list,

    async create(input: Record<string, unknown>): Promise<OfferingResult> {
      const id = businessId();
      const checked = validateOffering(input);
      if (!checked.ok) return { errors: checked.errors };
      if ((await deps.db.businessOffering.count({ where: { businessId: id, function: checked.value.function } })) >= OFFERING_LIMITS.maxPerFunction) {
        throw new ConflictError(`Please keep it to ${OFFERING_LIMITS.maxPerFunction} for one function`);
      }
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

    async remove(offeringId: string): Promise<Offering[]> {
      const removed = await deps.db.businessOffering.deleteMany({ where: { id: offeringId, businessId: businessId() } });
      if (removed.count === 0) throw new NotFoundError('Offering', offeringId);
      return list();
    },
  };
}

export const venueOfferingService = createVenueOfferingService();
