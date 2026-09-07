export interface SecurityHeader {
  key: string;
  value: string;
}

// Security-hardening audit finding (P2) — no security headers were
// configured anywhere. See next.config.ts's headers() for how this gets
// applied to every route. Kept as a pure function (not inlined in
// next.config.ts, which is loaded by Next's own config loader rather than
// going through the app's normal module graph) so the NODE_ENV-gated HSTS
// behavior is independently unit-testable.
export function buildSecurityHeaders(nodeEnv: string | undefined): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ];

  // HSTS only makes sense once the app is actually served over HTTPS — true
  // for every deployed (Vercel) build, not local `next dev`. Uses the same
  // NODE_ENV === 'production' convention already established elsewhere in
  // this codebase (app/api/otp/send/route.ts, app/api/seed/route.ts) for
  // distinguishing "deployed" from "local dev"; note this also covers Vercel
  // preview deployments (not just the production domain), which is the
  // intended/desired behavior here since previews are also served over HTTPS.
  if (nodeEnv === 'production') {
    headers.push({ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' });
  }

  return headers;
}
