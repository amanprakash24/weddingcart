import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { makeListSiteErrors } from '@/lib/siteErrors/handlers';
import { siteErrorService } from '@/services/siteError.service';
import { platformScoped } from '@/lib/ownership/entry';

// GET /api/admin/site-errors — staff: the errors people hit on the site (/admin/errors), and the number for Today.
const handleGET = makeListSiteErrors({
  requireAdmin: () => requireRole(ADMIN_ROLES),
  list: (status) => siteErrorService.list(status),
  countRecentOpen: () => siteErrorService.countRecentOpen(),
  setFixed: (id, fixed) => siteErrorService.setFixed(id, fixed),
});

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
