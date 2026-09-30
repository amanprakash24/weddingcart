import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { makeVendorAnswer } from '@/lib/vendorEnquiry/handlers';
import { vendorEnquiryService } from '@/services/vendorEnquiry.service';

// POST /api/vendor/enquiries/[id] — the logged-in vendor answers one of their own enquiries (§9).
export const POST = makeVendorAnswer({
  requireVendor: () => requireRole([Role.VENDOR]),
  answerAsVendor: (userId, id, input) => vendorEnquiryService.answerAsVendor(userId, id, input),
});
