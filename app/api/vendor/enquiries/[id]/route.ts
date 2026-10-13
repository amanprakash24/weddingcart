import { sharedRoute } from '@/lib/auth/workingVendor';
import { makeVendorAnswer } from '@/lib/vendorEnquiry/handlers';
import { vendorEnquiryService } from '@/services/vendorEnquiry.service';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/vendor/enquiries/[id] — an availability request to the vendor the person is working in is answered by its owner or
// anyone there who may work its enquiries (§9).
const handlePOST = makeVendorAnswer({
  vendor: () => sharedRoute('enquiries'),
  answerAsVendor: (who, id, input) => vendorEnquiryService.answerAsVendor(who, id, input),
});

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
