# Security Checklist — Auth.js

Assessed 2026-07-19 against the actual `lib/auth/auth.ts` written in Milestone 1 —
not a generic checklist. **Does not block Milestone 3** (data migration doesn't
touch auth), **must be resolved before Milestone 4** (Authentication Transition,
where vendor/customer login actually goes live).

| Area | Status | Finding |
|---|---|---|
| Session expiry | ⚠️ GAP | `session: { strategy: 'jwt' }` has no explicit `maxAge` — NextAuth v4 defaults to 30 days. The legacy `admin_session` cookie it's replacing uses 7 days (`lib/adminAuth.ts`). **Action:** set `session.maxAge` explicitly (recommend matching the existing 7-day admin behavior, and consider a shorter expiry for `SUPER_ADMIN`/`SALES` than `VENDOR`/`CUSTOMER` if the business wants that distinction). |
| CSRF protection | ✅ Likely OK, ⚠️ not yet exercised | NextAuth v4's built-in CSRF double-submit-cookie protection applies automatically to its own `/api/auth/*` endpoints and the `signIn()` client helper — nothing in `auth.ts` disables it. **Not yet verified end-to-end** because no login UI calls `signIn()` yet (the live `/admin/login` page still posts to the old HMAC `/api/admin/login`). Verify for real once Milestone 4 wires up an actual NextAuth-backed login form. |
| Cookie flags | ✅ Likely OK, ⚠️ not yet verified | No custom `cookies` block in `authOptions`, so NextAuth v4 defaults apply: `httpOnly: true`, `sameSite: 'lax'`, `secure: true` in production. Reasonable defaults, not overridden into something weaker. **Not yet verified** by inspecting an actual Set-Cookie header — no live DB to log in against yet. |
| Password hashing | ✅ Correct algorithm, ⚠️ seeding not built | `authorize()` uses `bcrypt.compare()` (via `bcryptjs`) correctly. The corresponding `bcrypt.hash()` call that will *create* `User.passwordHash` for the two admin accounts doesn't exist yet — it's part of the not-yet-written Milestone 3 "Users net-new" seeding step (`docs/migration-test-plan.md`). Default `bcryptjs` cost factor (10 rounds) is a reasonable choice — worth stating as a deliberate default, not revisiting unless a specific reason arises. |
| Rate limiting | ❌ GAP | Neither Credentials provider's `authorize()` has any rate limiting. The email+password provider has **no brute-force protection at all** — real risk once this becomes the live admin/sales login. The OTP provider's `authorize()` also has none (though the *existing* `/api/otp/send` Mongo endpoint does rate-limit at 60s/phone — that protection doesn't carry over automatically to the new Postgres-backed OTP flow and needs to be re-implemented there). **Action, required before Milestone 4:** add rate limiting (failed-attempt counter per email or per IP, with backoff/lockout) to the credentials `authorize()`, and re-implement the phone-based OTP send rate limit against Postgres. |
| Audit logging | ❌ Not built (expected — in scope for Milestone 4) | No login attempt (success or failure) is logged anywhere. This is explicitly named in the Authentication Transition milestone scope (`docs/architecture-review.md` §6) — not a surprise gap, just confirming it doesn't exist yet and isn't accidentally assumed to. |
| Secrets management | ✅ OK | `NEXTAUTH_SECRET` is set via `process.env`, no hardcoded secrets found anywhere in `lib/auth/*`. The dev value in `.env.local` is a randomly generated hex string explicitly commented "regenerate for staging/production" — confirm that regeneration actually happens before any real deploy, don't reuse the dev value. `.env.local` is gitignored (verified against `.gitignore`, not assumed) — no secrets have been committed. `DATABASE_URL`/`DIRECT_URL` are still placeholders; real Supabase credentials need the same "never commit, rotate dev vs. prod" treatment once provisioned. |

## Required before Milestone 4 (blocking)

1. Explicit `session.maxAge` (currently defaults to 30 days, unreviewed)
2. Rate limiting on both `authorize()` callbacks (currently none — the credentials
   provider in particular has zero brute-force protection)
3. Re-implement phone-based OTP send rate limiting against Postgres (the Mongo-era
   protection doesn't carry over)
4. Audit logging for login attempts (already in Milestone 4's stated scope)

## Verify once a live login flow exists (can't be checked without one)

5. CSRF token actually present/validated on a real `signIn()` call
6. Cookie flags as they actually appear in a Set-Cookie header (not just as
   configured/defaulted)

Not required to block Milestone 3 — none of the above affects data migration.
