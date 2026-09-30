import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { makeListReferrals } from '@/lib/growthPartner/handlers';
import { growthPartnerService } from '@/services/growthPartner.service';

// GET /api/admin/growth-partner-referrals — staff: referrals with their partner and assignee.
export const GET = makeListReferrals({
  requireAdmin: () => requireRole(ADMIN_ROLES),
  listPartners: (f) => growthPartnerService.listPartners(f),
  stats: () => growthPartnerService.stats(),
  updatePartner: (id, input) => growthPartnerService.updatePartner(id, input),
  listReferrals: (f) => growthPartnerService.listReferrals(f),
  updateReferral: (id, input) => growthPartnerService.updateReferral(id, input),
});
