import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { makeStaffAnswer } from '@/lib/vendorEnquiry/handlers';
import { vendorEnquiryService } from '@/services/vendorEnquiry.service';

// POST /api/crm/vendor-enquiries/[id]/answer — staff record what the vendor told them (§9).
export const POST = makeStaffAnswer({
  requireAdmin: () => requireRole(ADMIN_ROLES),
  listForSource: (sourceType, sourceId) => vendorEnquiryService.listForSource(sourceType, sourceId),
  answerAsStaff: (id, input, channel, actorId) => vendorEnquiryService.answerAsStaff(id, input, channel, actorId),
});
