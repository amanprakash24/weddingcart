import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { makeSetSiteErrorFixed } from '@/lib/siteErrors/handlers';
import { siteErrorService } from '@/services/siteError.service';
import { platformScoped } from '@/lib/ownership/entry';

// PATCH /api/admin/site-errors/[id] — staff: mark a site error fixed (or open again).
const handlePATCH = makeSetSiteErrorFixed({
  requireAdmin: () => requireRole(ADMIN_ROLES),
  list: (status) => siteErrorService.list(status),
  countRecentOpen: () => siteErrorService.countRecentOpen(),
  setFixed: (id, fixed) => siteErrorService.setFixed(id, fixed),
});

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const PATCH = platformScoped(handlePATCH);
