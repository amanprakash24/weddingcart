import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { makeVendorAnswer } from '@/lib/vendorEnquiry/handlers';
import { vendorEnquiryService } from '@/services/vendorEnquiry.service';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/vendor/enquiries/[id] — the logged-in vendor answers one of their own enquiries (§9).
const handlePOST = makeVendorAnswer({
  requireVendor: () => requireRole([Role.VENDOR]),
  answerAsVendor: (userId, id, input) => vendorEnquiryService.answerAsVendor(userId, id, input),
});

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
