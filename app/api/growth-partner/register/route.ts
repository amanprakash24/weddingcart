import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import { makeRegister } from '@/lib/growthPartner/handlers';
import { growthPartnerService } from '@/services/growthPartner.service';

// POST /api/growth-partner/register — public Growth Partner registration (docs/wedding-os/14-growth-partner.md).
export const POST = makeRegister({
  isLimited: isRequestRateLimited,
  record: recordRequest,
  register: (input) => growthPartnerService.register(input),
  submitReferral: (input) => growthPartnerService.submitReferral(input),
});
