import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { makeStaffAnswer } from '@/lib/vendorEnquiry/handlers';
import { vendorEnquiryService } from '@/services/vendorEnquiry.service';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/crm/vendor-enquiries/[id]/answer — staff record what the vendor told them (§9).
const handlePOST = makeStaffAnswer({
  requireAdmin: () => requireRole(ADMIN_ROLES),
  listForSource: (sourceType, sourceId) => vendorEnquiryService.listForSource(sourceType, sourceId),
  answerAsStaff: (id, input, channel, actorId) => vendorEnquiryService.answerAsStaff(id, input, channel, actorId),
});

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
