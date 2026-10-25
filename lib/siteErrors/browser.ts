// Site errors (25 Oct 2026), browser side: send an error to POST /api/site-errors for /admin/errors. Safe to call anywhere;
// never throws and never blocks the page. At most 5 different errors per page load, each once. Built site only (or
// NEXT_PUBLIC_SITE_ERRORS_DEV=1). The server cleans and groups the report (lib/siteErrors/normalize.ts).
const MAX_PER_PAGE = 5;
const sent = new Set<string>();

function describe(err: unknown): { message: string; detail: string | null } {
  if (err instanceof Error) {
    const name = err.name && err.name !== 'Error' ? `${err.name}: ` : '';
    return { message: `${name}${err.message}`, detail: err.stack ?? null };
  }
  if (typeof err === 'string') return { message: err, detail: null };
  return { message: 'Unknown browser error', detail: null };
}

export function reportBrowserError(err: unknown): void {
  try {
    if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_SITE_ERRORS_DEV !== '1') return;
    if (typeof window === 'undefined') return;
    const { message, detail } = describe(err);
    const location = window.location.pathname;
    const key = `${location}|${message}`;
    if (sent.has(key) || sent.size >= MAX_PER_PAGE) return;
    sent.add(key);
    const body = JSON.stringify({ message: message.slice(0, 2000), location: location.slice(0, 1000), detail: detail?.slice(0, 8000) ?? null });
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon?.('/api/site-errors', blob)) return;
    void fetch('/api/site-errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {
    /* reporting must never cause a problem of its own */
  }
}
