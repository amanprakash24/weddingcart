import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { makeListReferrals } from '@/lib/growthPartner/handlers';
import { growthPartnerService } from '@/services/growthPartner.service';
import { platformScoped } from '@/lib/ownership/entry';

// GET /api/admin/growth-partner-referrals — staff: referrals with their partner and assignee.
const handleGET = makeListReferrals({
  requireAdmin: () => requireRole(ADMIN_ROLES),
  listPartners: (f) => growthPartnerService.listPartners(f),
  stats: () => growthPartnerService.stats(),
  updatePartner: (id, input) => growthPartnerService.updatePartner(id, input),
  listReferrals: (f) => growthPartnerService.listReferrals(f),
  updateReferral: (id, input) => growthPartnerService.updateReferral(id, input),
});

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
