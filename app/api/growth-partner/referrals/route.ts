import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import { makeSubmitReferral } from '@/lib/growthPartner/handlers';
import { growthPartnerService } from '@/services/growthPartner.service';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/growth-partner/referrals — a registered partner submits a referral (mobile + Partner code).
const handlePOST = makeSubmitReferral({
  isLimited: isRequestRateLimited,
  record: recordRequest,
  register: (input) => growthPartnerService.register(input),
  submitReferral: (input) => growthPartnerService.submitReferral(input),
});

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
