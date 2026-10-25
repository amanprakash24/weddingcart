import { cleanSiteError, routeFromStack } from './normalize';

// Site errors (25 Oct 2026): record a server-side error for /admin/errors. Never throws — a failure to record must not
// turn into a second error for the visitor. Only on the built site (production and previews); local development records
// nothing unless SITE_ERRORS_DEV=1, so a dev server pointed at a real database does not fill it with local mistakes.
export function siteErrorsEnabled(): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  return process.env.NODE_ENV === 'production' || process.env.SITE_ERRORS_DEV === '1';
}

export async function reportServerError(err: unknown, where: { location?: string | null } = {}): Promise<void> {
  if (!siteErrorsEnabled()) return;
  try {
    const error = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Non-error thrown');
    const name = error.name && error.name !== 'Error' ? `${error.name}: ` : '';
    const clean = cleanSiteError({
      source: 'SERVER',
      message: `${name}${error.message}`,
      location: where.location || routeFromStack(error.stack) || 'server',
      detail: error.stack ?? null,
    });
    if (!clean) return;
    const { siteErrorService } = await import('@/services/siteError.service');
    await siteErrorService.record(clean);
  } catch (inner) {
    console.error('[site-errors] could not record an error:', inner);
  }
}
