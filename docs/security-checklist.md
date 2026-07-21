# Security Checklist — Auth.js

Assessed 2026-07-19 against the actual `lib/auth/auth.ts` written in Milestone 1 —
not a generic checklist. **Does not block Milestone 3** (data migration doesn't
touch auth), **must be resolved before Milestone 4** (Authentication Transition,
where vendor/customer login actually goes live).

| Area | Status | Finding |
|---|---|---|
| Session expiry | ✅ FIXED (2026-07-21) | `authOptions.session.maxAge` now explicitly set to 7 days (`SESSION_MAX_AGE_SECONDS` in `lib/auth/auth.ts`), matching the legacy `admin_session` cookie behavior rather than NextAuth's 30-day default. |
| CSRF protection | ✅ VERIFIED LIVE (2026-07-21) | Tested directly against the running app (not assumed): a `callback/credentials` POST with a csrfToken that doesn't match the caller's own `next-auth.csrf-token` cookie returns `{"url":".../signin?csrf=true"}`, issues **no** session cookie, and — critically — creates **no** `LoginAttempt` row, proving the request is rejected before `authorize()` ever runs. A matching, valid CSRF token signs in correctly. |
| Cookie flags | ✅ VERIFIED LIVE (2026-07-21) | Real `Set-Cookie` header captured from a successful admin sign-in: `next-auth.session-token=...; Path=/; Expires=<+7 days>; HttpOnly; SameSite=Lax`. `HttpOnly` and `SameSite=Lax` confirmed present; `Expires` confirmed exactly 7 days out, matching `SESSION_MAX_AGE_SECONDS`. `Secure` is correctly absent over local `http://` (NextAuth adds it automatically once `NODE_ENV=production` runs over `https://` — not independently testable without a real HTTPS deploy, but the mechanism is a stock NextAuth v4 default, not custom code). |
| Password hashing | ✅ Correct algorithm, ⚠️ seeding not built | `authorize()` uses `bcrypt.compare()` (via `bcryptjs`) correctly. The corresponding `bcrypt.hash()` call that will *create* `User.passwordHash` for the two admin accounts doesn't exist yet — it's part of the not-yet-written Milestone 3 "Users net-new" seeding step (`docs/migration-test-plan.md`). Default `bcryptjs` cost factor (10 rounds) is a reasonable choice — worth stating as a deliberate default, not revisiting unless a specific reason arises. |
| Rate limiting | ✅ FIXED (2026-07-21) | Both Credentials providers (`credentials` and `otp`) now call `isRateLimited()`/`recordLoginAttempt()` (`lib/auth/rateLimit.ts`), backed by a new Postgres `LoginAttempt` table (migration `20260719194713_add_login_attempt`, applied to staging): 5 failures / 15-minute window locks out an identifier before the password/OTP is even checked. Separately, `/api/otp/send` and `/api/otp/verify` are now repointed at Postgres (`repositories/otp.repository.ts`, `services/otp.service.ts`), with the 60s resend cooldown re-implemented there (verified live against staging: age-check reads correct real-time deltas, second request within the window is blocked with `waitSeconds`). |
| Audit logging | ✅ Adequate for v1 | Every login attempt (success or failure, both providers) is written to `LoginAttempt` (identifier, success, timestamp) via `recordLoginAttempt()` — satisfies the Milestone 4 scope item. Not yet exposed in any admin UI (no reporting view built), and doesn't capture IP/user-agent — acceptable for v1, revisit if abuse investigation ever needs more than identifier+outcome+time. |
| Secrets management | ✅ OK | `NEXTAUTH_SECRET` is set via `process.env`, no hardcoded secrets found anywhere in `lib/auth/*`. The dev value in `.env.local` is a randomly generated hex string explicitly commented "regenerate for staging/production" — confirm that regeneration actually happens before any real deploy, don't reuse the dev value. `.env.local` is gitignored (verified against `.gitignore`, not assumed) — no secrets have been committed. `DATABASE_URL`/`DIRECT_URL` are still placeholders; real Supabase credentials need the same "never commit, rotate dev vs. prod" treatment once provisioned. |

## Required before Milestone 4 (blocking) — ALL RESOLVED 2026-07-21

1. ✅ Explicit `session.maxAge` — 7 days, matches legacy admin cookie
2. ✅ Rate limiting on both `authorize()` callbacks — Postgres-backed, 5 failures/15min
3. ✅ Phone-based OTP send rate limiting re-implemented against Postgres — 60s cooldown,
   verified live against staging
4. ✅ Audit logging for login attempts — `LoginAttempt` table records every attempt

## Live login flow — built and verified (2026-07-21)

5. ✅ CSRF token presence/validation — verified live, see above
6. ✅ Cookie flags as they actually appear in a Set-Cookie header — verified live, see above

Admin login (`/admin/login`, NextAuth `credentials` provider), Vendor and Customer
OTP login (`/vendor/login`, `/customer/login`, NextAuth `otp` provider), role-based
middleware protection (`/admin`, `/vendor`, `/customer` prefixes), and logout are
all built and exercised end-to-end against real staging Postgres:
unauthorized-access redirects, successful sign-in, rate-limit lockout (5th failure
blocks the 6th attempt pre-DB-lookup), OTP resend cooldown (429), wrong-code
rejection, and logout re-locking the portal all confirmed live, not assumed.

**Milestone 4 (Authentication Transition) is now fully complete** — all 6 items in
this checklist are resolved.
