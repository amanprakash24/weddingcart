import type { Instrumentation } from 'next';

// Site errors (25 Oct 2026): every server error Next.js catches — a page that fails to render, a route handler or server
// action that throws — is recorded for /admin/errors (lib/siteErrors/report.ts). Routes that catch their own errors report
// through handleApiError (lib/errors.ts) instead. Node.js runtime only: recording needs the database.
export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { reportServerError } = await import('./lib/siteErrors/report');
  await reportServerError(err, { location: request.path });
};
