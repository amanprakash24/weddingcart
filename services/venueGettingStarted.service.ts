import { prisma } from '@/lib/prisma';
import { currentBusiness } from '@/lib/ownership/business';
import { effectiveScope } from '@/lib/ownership/scope';
import { can } from '@/lib/auth/permissions';
import { buildGettingStarted, type GettingStarted } from '@/lib/venue/gettingStarted';

// "Getting started" on Today: four counts about the business the request runs as, and nothing else. Read-only. Always called
// inside the business's scope (lib/ownership/venueEntry.ts): enquiries and quotations are owned records, so the database guard
// counts this business's only; the price list is not an owned table, so the business is named here, from the scope.
// The answer carries no customer's name, no amount and no UPI ID — only which of the four things exist — so any member may ask.

export interface VenueGettingStartedDeps {
  db: {
    businessOffering: Pick<typeof prisma.businessOffering, 'count'>;
    consultation: Pick<typeof prisma.consultation, 'count'>;
    quotation: Pick<typeof prisma.quotation, 'count'>;
  };
  business: typeof currentBusiness;
}

const defaultDeps = (): VenueGettingStartedDeps => ({ db: prisma, business: currentBusiness });

export function createVenueGettingStartedService(deps: VenueGettingStartedDeps = defaultDeps()) {
  return {
    async get(): Promise<GettingStarted> {
      const scope = effectiveScope();
      const business = await deps.business();
      const [offerings, enquiries, quotationsSent] = await Promise.all([
        deps.db.businessOffering.count({ where: { businessId: business.id, active: true } }),
        deps.db.consultation.count(),
        // Sent at some point — whatever became of it since (accepted, expired, replaced by a revision).
        deps.db.quotation.count({ where: { consultationId: { not: null }, sentAt: { not: null } } }),
      ]);
      return buildGettingStarted({ offerings, hasUpi: !!business.upiId, enquiries, quotationsSent }, (p) => can(scope, p));
    },
  };
}

export const venueGettingStartedService = createVenueGettingStartedService();
