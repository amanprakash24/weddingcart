import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import { makeReportBrowserError } from '@/lib/siteErrors/handlers';
import { siteErrorService } from '@/services/siteError.service';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/site-errors — public: a visitor's browser reports an error (components/SiteErrorReporter.tsx) for /admin/errors.
const handlePOST = makeReportBrowserError({
  isLimited: isRequestRateLimited,
  recordRequest,
  save: (error) => siteErrorService.record(error),
});

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
