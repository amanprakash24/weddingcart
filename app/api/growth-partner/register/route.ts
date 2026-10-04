import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import { makeRegister } from '@/lib/growthPartner/handlers';
import { growthPartnerService } from '@/services/growthPartner.service';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/growth-partner/register — public Growth Partner registration (docs/wedding-os/14-growth-partner.md).
const handlePOST = makeRegister({
  isLimited: isRequestRateLimited,
  record: recordRequest,
  register: (input) => growthPartnerService.register(input),
  submitReferral: (input) => growthPartnerService.submitReferral(input),
});

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
