import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import { makeSubmitReferral } from '@/lib/growthPartner/handlers';
import { growthPartnerService } from '@/services/growthPartner.service';

// POST /api/growth-partner/referrals — a registered partner submits a referral (mobile + Partner code).
export const POST = makeSubmitReferral({
  isLimited: isRequestRateLimited,
  record: recordRequest,
  register: (input) => growthPartnerService.register(input),
  submitReferral: (input) => growthPartnerService.submitReferral(input),
});
