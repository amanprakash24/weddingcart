import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { makeListPartners } from '@/lib/growthPartner/handlers';
import { growthPartnerService } from '@/services/growthPartner.service';

// GET /api/admin/growth-partners — staff: partners and the headline numbers.
export const GET = makeListPartners({
  requireAdmin: () => requireRole(ADMIN_ROLES),
  listPartners: (f) => growthPartnerService.listPartners(f),
  stats: () => growthPartnerService.stats(),
  updatePartner: (id, input) => growthPartnerService.updatePartner(id, input),
  listReferrals: (f) => growthPartnerService.listReferrals(f),
  updateReferral: (id, input) => growthPartnerService.updateReferral(id, input),
});
