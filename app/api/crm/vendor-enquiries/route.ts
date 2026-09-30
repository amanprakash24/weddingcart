import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { makeListForSource } from '@/lib/vendorEnquiry/handlers';
import { vendorEnquiryService } from '@/services/vendorEnquiry.service';

// GET /api/crm/vendor-enquiries?sourceType=…&sourceId=… — staff: vendor enquiries for one customer record (§9).
export const GET = makeListForSource({
  requireAdmin: () => requireRole(ADMIN_ROLES),
  listForSource: (sourceType, sourceId) => vendorEnquiryService.listForSource(sourceType, sourceId),
  answerAsStaff: (id, input, channel, actorId) => vendorEnquiryService.answerAsStaff(id, input, channel, actorId),
});
