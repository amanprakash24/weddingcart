import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { COMMERCIAL_RULES } from '@/lib/commercial/rules';
import { businessById, proposalBrandFor } from '@/lib/ownership/business';
import { effectiveScope } from '@/lib/ownership/scope';
import { validateVenueSettings, type SettingsField, type VenueSettingsValue } from '@/lib/venue/settings';

// A venue's own business settings (Phase C): the number its own couples see on their proposal link (D8) and the rule its own
// customers book under. Always called inside the venue's scope (lib/ownership/venueEntry.ts) — the business is the scope's, never
// one named by a request. Business is not an owned table, so these reads and writes need no scope of their own.
// Only the Owner changes them; Staff see them.

export interface VenueSettingsView extends VenueSettingsValue {
  businessName: string;
  numberPrefix: string | null; // the code on its documents (SWA-QTN-…) — given once, not editable
  shownPhone: string | null; // what its couples see today: its own number, else the listing's
  defaults: { confirmationPercent: number; holdWindowDays: number };
  canEdit: boolean;
}

export type UpdateResult = VenueSettingsView | { errors: Partial<Record<SettingsField, string>> } | { forbidden: true };

export interface VenueSettingsDeps {
  db: { business: Pick<typeof prisma.business, 'update'> };
  business: typeof businessById;
  brand: typeof proposalBrandFor;
}

const defaultDeps = (): VenueSettingsDeps => ({ db: prisma, business: businessById, brand: proposalBrandFor });

export function createVenueSettingsService(deps: VenueSettingsDeps = defaultDeps()) {
  // The venue this work runs as. Shaadi Shopping's own rule lives in code (lib/commercial/rules.ts), so the platform has no settings here.
  async function venue() {
    const scope = effectiveScope();
    if (scope.kind !== 'BUSINESS') throw new NotFoundError('Business', 'current');
    const business = await deps.business(scope.businessId);
    if (business.kind !== 'VENDOR') throw new NotFoundError('Business', scope.businessId);
    return { business, role: scope.role };
  }

  async function get(): Promise<VenueSettingsView> {
    const { business: b, role } = await venue();
    return {
      businessName: b.name,
      numberPrefix: b.numberPrefix,
      contactPhone: b.contactPhone,
      confirmationPercent: b.confirmationPercent,
      holdWindowDays: b.holdWindowDays,
      shownPhone: (await deps.brand(b.id)).phone,
      defaults: { confirmationPercent: COMMERCIAL_RULES.confirmationPercent, holdWindowDays: COMMERCIAL_RULES.holdWindowDays },
      canEdit: role === 'OWNER',
    };
  }

  return {
    get,

    async update(input: Partial<Record<SettingsField, unknown>>): Promise<UpdateResult> {
      const { business, role } = await venue();
      if (role !== 'OWNER') return { forbidden: true };
      const checked = validateVenueSettings(input);
      if (!checked.ok) return { errors: checked.errors };
      await deps.db.business.update({ where: { id: business.id }, data: checked.value });
      return get();
    },
  };
}

export const venueSettingsService = createVenueSettingsService();
