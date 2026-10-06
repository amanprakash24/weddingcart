import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { makeUpdateReferral } from '@/lib/growthPartner/handlers';
import { growthPartnerService } from '@/services/growthPartner.service';
import { platformScoped } from '@/lib/ownership/entry';

// PATCH /api/admin/growth-partner-referrals/[id] — staff: status, assignee, payout, notes.
const handlePATCH = makeUpdateReferral({
  requireAdmin: () => requireRole(ADMIN_ROLES),
  listPartners: (f) => growthPartnerService.listPartners(f),
  stats: () => growthPartnerService.stats(),
  updatePartner: (id, input) => growthPartnerService.updatePartner(id, input),
  listReferrals: (f) => growthPartnerService.listReferrals(f),
  updateReferral: (id, input) => growthPartnerService.updateReferral(id, input),
});

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const PATCH = platformScoped(handlePATCH);
