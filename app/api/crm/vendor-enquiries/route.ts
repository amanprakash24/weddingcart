import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { makeListForSource } from '@/lib/vendorEnquiry/handlers';
import { vendorEnquiryService } from '@/services/vendorEnquiry.service';
import { platformScoped } from '@/lib/ownership/entry';

// GET /api/crm/vendor-enquiries?sourceType=…&sourceId=… — staff: vendor enquiries for one customer record (§9).
const handleGET = makeListForSource({
  requireAdmin: () => requireRole(ADMIN_ROLES),
  listForSource: (sourceType, sourceId) => vendorEnquiryService.listForSource(sourceType, sourceId),
  answerAsStaff: (id, input, channel, actorId) => vendorEnquiryService.answerAsStaff(id, input, channel, actorId),
});

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
