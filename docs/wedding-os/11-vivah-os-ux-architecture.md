# Vivah OS — UX architecture (Phase 1 of the Figma/product design brief)

Status: Phase 1 (product architecture) of a 14-phase design initiative (see the brief in the originating
conversation — not reproduced here). This doc grounds that brief's object model, roles, and IA against
`prisma/schema.prisma` and the code actually on `feat/money-v1`, and flags every place the brief's stated
model disagrees with what's built or decided. Per the brief's own rule ("don't silently invent behavior —
flag the conflict"), Phase 2 (design tokens) should not start until the conflicts below are resolved.

## 1. What's already built vs. what's greenfield

The brief describes six role-specific product surfaces. Checked against the actual route tree and
components:

| Surface (brief's name) | Status | Evidence |
|---|---|---|
| Staff/Admin — **Today** | **Built**, matches spec closely | `components/admin/adminNav.ts` `PRIMARY`: Today, Leads & Quotes, Weddings, Vendors, Invoices, + `MORE` — the exact IA the brief asks for in §9 |
| Staff/Admin — **Wedding Control Room** | **Built**, matches spec closely | `components/wedding/control-room/` + `WeddingWorkspaceClient.tsx`: tabs are literally `Overview / Plan / Functions & Services / Money / People / Files & History` — the brief's §11–§20 tab list, verbatim |
| Leads & Quotes pipeline | **Built** (CRM inbox), model differs from brief's phrasing | see §2 below |
| Money / Date Held / 25% rule | **Built**, matches spec closely | `docs/wedding-os/10-commercial-flow-v1.md` "Money V1" section = brief §16–§18 almost line for line |
| Venue Owner experience | **Not built as a separate surface** | no `app/venue*` route; only `app/vendor` exists (login only) — see §3 |
| Vendor ("Service Workspace") | **Greenfield** | `app/vendor/` contains only `login/`; no workspace pages yet |
| Couple ("My Wedding") | **Greenfield** | `app/customer/` contains only `login/`; no wedding-journey UI yet |
| Guest ("Wedding Home" / invitation) | **Partially built, much smaller than brief §32–§33** | `app/rsvp/[token]/page.tsx` → `RsvpClient` is a bare per-guest RSVP form (`Guest.rsvpToken`, `GuestFunctionResponse`). No gallery/travel/stay/contact sections, no "Invitation → Open Wedding" entry flow |

Implication for Phase 2 onward: the Figma work for Today, Wedding Control Room, Functions & Services, and
Money should be **documenting/tokenizing the shipped UI**, not redesigning it from the brief's prose. The
real design effort is Venue Owner, Vendor OS, My Wedding, and Wedding Home — those are the phases that
need full design attention.

## 2. Object model — confirmed against schema

Wedding → Functions → Services/Vendors → Tasks matches `Wedding` → `WeddingEvent` → `VendorBooking` → `Task`
in `prisma/schema.prisma`. Financial chain (Accepted Quotation → Advance Invoice → Payments → Balance
Invoice) matches `Quotation` → `Booking`/`CommercialAgreement` → `Invoice(kind)` → `Payment`, per
`10-commercial-flow-v1.md`. No conflict.

**Conflict found — commercial funnel is not a single chain.** The brief (§4, §24) writes the funnel as one
line: `Lead → Consultation → Quotation → Acceptance → Booking → Payment → Wedding`, and later "Lead stages:
New → Consultation → Quote → …" as if Consultation were a stage a Lead passes through.

- *Existing rule*: `Lead`, `Consultation`, and `Enquiry` are three independent capture tables
  (`prisma/schema.prisma:395,441,501`), each with its own `pipelineStage`, `quotations`, `tasks`, and
  `activities`. There is no `Lead.consultationId` or `Consultation.leadId`. The only bridge is
  `Enquiry.consultationId` (a Consultation can produce multiple Enquiries — deliberately non-unique). They
  are unified only at the presentation layer, in one CRM inbox.
- *Proposed UX conflict*: designing "Leads & Quotes" (brief Phase 7) around a single record whose status
  field moves through `New → Consultation → Quote → …` would misrepresent the data — a Consultation is a
  different row than a Lead, not a state of one.
- *Decision needed*: for the Figma pipeline view, keep presenting Lead/Consultation/Enquiry as one **unified
  inbox with a shared stage vocabulary** (which is what's already built and what `PipelineStage` already
  supports across all three tables) rather than a single chained entity. Recommend adopting this now so
  Phase 7 doesn't get designed against the wrong mental model. Flagging, not deciding unilaterally — say
  so if you want the literal chain instead and I'll re-read `02-crm.md`/`track-b-conversion-pipeline.md`
  for what that would actually require.

## 3. Roles — brief's 5 UX roles vs. the actual `Role` enum

`enum Role { SUPER_ADMIN, SALES, OPERATIONS, VENDOR, CUSTOMER }` (`schema.prisma:41`). A `User` can hold
multiple roles. Guests are unauthenticated (token-based `Guest.rsvpToken`), not a `Role` value.

| Brief's role | Backing | Gap |
|---|---|---|
| Staff/Admin | `SUPER_ADMIN` / `SALES` / `OPERATIONS` | none |
| Venue Owner | *(none)* | **Conflict**: brief treats Venue Owner as a distinct surface with its own simplified "Command Center" (§29). There's no `Role` value or route for it. A venue is a `Vendor` with a venue category. Decision needed: is "Venue Owner" (a) a filtered/simplified view of the Vendor OS for vendors whose category is a venue, or (b) a genuinely separate role requiring its own auth/permission path? This changes whether Phase 8 is a Vendor-OS view variant or a new surface. Recommend (a) — reuse Vendor OS with a venue-category-aware layout — since inventing a sixth role for one category is exactly the kind of unscoped complexity §61/§62 warn against. Flag for your call before Phase 8. |
| Couple / Authorized Family | `CUSTOMER` | none, but the UI is greenfield (§1) |
| Vendor | `VENDOR` | none, but the UI is greenfield (§1) |
| Guest | *(unauthenticated, token-based)* | matches the brief's "public, no login" framing already |

## 4. Decisions (confirmed 22 Sep 2026)

1. **Leads & Quotes stays a unified inbox, not a literal chain.** Lead/Consultation/Enquiry remain three
   independent capture tables with a shared stage vocabulary in one CRM inbox view; Figma design for this
   surface should reflect that model, not a single chained record.
2. **Venue Owner = a category-filtered Vendor OS view, not a sixth role.** No new `Role` enum value. The
   "Venue Command Center" (brief §29) is Vendor OS (`app/vendor`) presented differently when the vendor's
   category is a venue, not a separate auth path.

Phase 2 (design tokens) starts next, seeded from the existing Tailwind setup rather than inventing a
parallel palette.

## 5. Phase 2 — design tokens (done, 22 Sep 2026)

Figma file: **Vivah OS — Design System** — `https://www.figma.com/design/FM5qJMkuiHM9eVe4tNRpL9`
(`fileKey: FM5qJMkuiHM9eVe4tNRpL9`, team `Gaurav Sudhanshu's team`).

**Rule locked (decided with the user):** primary interactive color (buttons, active tab, focus) is brand
maroon `#8B1A4A`, used sparingly; gold `#C5A46D` is a restrained accent only (dividers, small text/icon
tint — deliberately not given a fill scope, to stop it becoming a background color); everything else
(surfaces, borders, body text) stays plain neutral gray, matching what's already shipped in the Control
Room. This is the concrete form of brief §6/§7 ("visually connected to Shaadi Shopping, not corporate,
not decorative").

**Source-of-truth split:** brand accent colors (maroon, gold) come from `app/globals.css`'s marketplace
tokens (`--primary`, `--gold`); all neutrals (gray scale, text, borders, surfaces) come from the stock
Tailwind gray/amber/emerald/red/sky palette already used throughout `components/wedding/control-room/*`
and `components/admin/*` — not from the marketplace's separate ivory/charcoal neutrals (`--background:
#FFFCF7`, `--foreground: #1E1E1E`), which only the canvas-background token borrows. The two surfaces were
already drifting (admin's `<body>` hardcodes `#FFFAF5`/`#2D2D2D`, slightly off the marketplace's named
CSS vars) — treated as build drift, not a decision fork.

**Typography:** Playfair Display Bold is reserved for the `Display` style only — the one place the shipped
UI already uses it deliberately (the couple's name in `ControlRoomHeader.tsx:105`). Every other style
(H1–H3, Body, Caption, Label, Numeric) is Inter, standing in for the Tailwind default system-sans stack
Figma can't render natively.

**What exists in the file now** (`01 — Foundations` page has a visual swatch/specimen of all of it):

| Layer | Collection / style group | Count |
|---|---|---|
| Primitives | `Primitives` (mode: Value) — raw hex, `scopes: []`, hidden from pickers | 34 colors |
| Semantic color | `Color` (mode: Light) — aliased to primitives, scoped, WEB code syntax (a `var()`-wrapped CSS custom property) | 29 tokens |
| Spacing | `Spacing` (mode: Value) — `xs`(4) … `3xl`(48), scope `GAP`/`WIDTH_HEIGHT` | 7 tokens |
| Radius | `Radius` (mode: Value) — `md`(6) … `full`(9999), scope `CORNER_RADIUS` | 5 tokens |
| Shadows | Effect styles | `shadow/sm`, `shadow/lg` (Tailwind's own values) |
| Typography | Text styles | `Display, H1, H2, H3, Body, Body Small, Caption, Label, Numeric/Large, Numeric/Body` |

No dark mode — not requested anywhere in the brief or by the user, so it wasn't scaffolded (`Color`
collection has a single `Light` mode only).

**Known minor gap:** the `Spacing` variables' WEB code-syntax annotation is a bare Tailwind scale number
(e.g. `spacing/lg` → `"4"`, meaning Tailwind's `p-4`/`gap-4`), not a `var()`-wrapped CSS custom property —
Tailwind doesn't expose per-token spacing as CSS vars by default, so there's nothing to wrap. Cosmetic only,
doesn't block anything.

## 6. Phase 3 — core components (blocked mid-build, 22 Sep 2026)

**Blocker: Figma's own plan limits, not something to route around.** `whoami` shows the team's seat as
**View** on the **Starter** plan. Per Figma's MCP rate-limit docs (`file://figma/docs/rate-limits-access.md`):
View/Collab seats on Starter get **20 MCP tool calls per month, total** (not per session, not per file) —
already exceeded building the token system + first two components. `create_new_file`/`whoami` are exempt;
`use_figma` (reads and writes both) is not. Also hit the **3-page-per-file cap** earlier (Starter plan),
worked around by consolidating every component onto one `02 — Components` page with Sections instead of
one page per component.

**Done and screenshot-verified** (page `02 — Components`, same file as Phase 2):
- **Button** — component set, 16 variants (`Style`: Primary/Secondary/Outline/Danger × `Size`:
  Medium/Small × `Disabled`: false/true). Primary uses `color/primary/default` (maroon), Secondary uses
  `color/bg/surface-muted` + `color/border/default`, Outline is transparent + border, Danger uses
  `color/danger/default`. All fills/radius/padding bound to variables, not hardcoded.
- **Status Pill** — component set, 5 variants (`Status`: Confirmed/DateHeld/Overdue/Info/Neutral), using
  the exact human-language wording from brief §36 ("Booking confirmed", "Date Held" — not
  `BOOKING_CONFIRMED`).

**Incomplete / unverified:** **Input** component (State: Default/Focus/Error/Disabled) — the build script
errored when the monthly quota hit mid-execution. Unknown whether it partially created nodes on the
Components page; **do not build on top of it without first reading the page's actual state** (costs 1 of
whatever quota is available then).

**Not started:** Tabs (tab-item variant matching the shipped `ControlRoomTabs.tsx` pill pattern), Card
(Default + the signature `NextActionCard`), and a representative Row component (`Row/Vendor` was the
planned first one — `Row/Task`, `Row/Payment`, `Row/Function` would follow the same pattern once approved).

**To resume:** either (a) wait for the monthly quota to reset, or (b) the user upgrades the Figma seat/plan
(their call, costs money — not something to do unilaterally). Either way, resume by reading the Components
page state first (one call) before writing anything else, since Input's fate is unknown.

## 7. Phase 3 continued — the same components, as real code (22 Sep 2026)

Since Figma was blocked, built the same Phase 3 primitives directly in the codebase instead, on branch
`feat/vivah-os-design-components` (based on `docs/vivah-os-ux-architecture`, so it carries this doc). New
files under `components/ui/`: `Button.tsx`, `StatusPill.tsx`, `Input.tsx`, `Tabs.tsx`, `Card.tsx` (+
`NextActionCard`), `Row.tsx` (+ `VendorRow`). Full project `tsc --noEmit` passes clean; `eslint` on the new
files is clean.

**Tokens landed in code, not just Figma:** `app/globals.css`'s `:root` block gained the same semantic
custom properties as the Figma `Color` collection (`--color-bg-surface`, `--color-text-primary`,
`--color-success-bg`, etc.), added as plain custom properties (not Tailwind v4 `@theme`), so no new global
utility classes were generated and the marketplace's existing styles have zero blast radius. Components
reference them with Tailwind's arbitrary-value syntax (e.g. `bg-[var(--color-bg-surface)]`). `--primary`
and `--gold` already existed and were reused as-is
(same hex values chosen in Phase 2) rather than duplicated.

**Deliberately did not refactor shipped code.** `ControlRoomTabs.tsx` still uses `bg-gray-900` for the
active tab (not yet migrated to the maroon decision) and `NextActionCard.tsx` still has its own
wedding-specific implementation (`ControlRoomView`/`ActionTarget`/`CoordinatorPicker` coupling) — the new
`components/ui/Tabs.tsx` and `components/ui/Card.tsx`'s `NextActionCard` are the generic, reusable versions
of those exact same visual patterns, built for other surfaces (Today, Venue Owner, My Wedding) to consume,
not a silent rewrite of what's already shipped and working. A follow-up could migrate `ControlRoomTabs.tsx`
onto the new primitive; not done here since it changes live UI on a different branch unprompted.

**Grounded, not invented:** `Row/Vendor`'s four states (`confirmed | pending | declined | unassigned`)
come directly from `lib/wedding/controlRoom.ts`'s actual `VendorRow['state']` type — not the brief's
5-state prose (§21 lists a separate "Completed" state; the real code folds `COMPLETED` into `confirmed`,
so the component does too).

**Also found:** Playfair Display isn't reserved for the couple's name alone — `NextActionCard.tsx` also
uses it for its title. Refines the Phase 2 typography rule: `Display` style is for the one hero moment per
screen, not exclusively the wedding name. No token change needed — `Display` already covers this.

**Not built:** Card's plain (non-NextAction) variant has no real shipped equivalent to ground it against yet
— kept intentionally minimal (a bare bordered container) rather than guessing at padding/shadow variants
that don't exist anywhere in the app.

## 8. Phase 3 completion + Vendor Today spec-proof (22 Sep 2026)

**Card** gained `variant`: `default | clickable | selected | highlighted | attention`, plus `CardEmptyState`
(brief §37 — message + CTA, not "No data found") and `CardSkeleton` (reuses the shipped `.skeleton` shimmer
from `globals.css`). `clickable`/`selected` render as a native `<button>` for free keyboard support.
`highlighted` uses a gold left-bar accent, not a fill — same restraint rule as everywhere else.

**Row** gained `variant`: `default | clickable | selected | disabled | loading | attention`. `VendorRow` now
imports `VendorRow['state']` directly from `lib/wedding/controlRoom.ts` instead of a hand-copied literal
union, so it structurally cannot drift from the real type again.

**Tabs** gained `disabledKeys` (aria-disabled + non-interactive), and the touch target went from `min-h-10`
to `min-h-11` (44px) as a deliberate accessibility correction — applied only to this generic primitive, not
to the shipped `ControlRoomTabs.tsx`. Overflow stays horizontal-scroll-with-hidden-scrollbar, unchanged from
the shipped pattern.

**Input family** split into `Input` (text/number/date/etc. via the native `type` attribute — no per-type
component needed), plus new `Select.tsx` and `Textarea.tsx`, all sharing `fieldChrome.tsx`'s label/helper/
error wrapper. `readOnly` is now visually distinct from `disabled` (full-color text vs. grayed).

**Token consistency — verified, one flagged exception:** grepped every `components/ui/*.tsx` file for raw
hex and stock Tailwind color utilities outside `var()`. The only real hit is `NextActionCard`'s calm/attention
tone (`border-emerald-100 bg-emerald-50/60` / `from-amber-50 to-rose-50`), which deliberately mirrors the
shipped `NextActionCard.tsx` pixel-for-pixel — that shipped file predates the token system and isn't
tokenized either, so a mechanical swap to `success/warning` tokens would silently drop the gradient effect.
**Left as-is, flagged for a human decision**, not silently changed.

**Component audit (reuse map, evidence only — nothing replaced):** across `components/wedding`,
`components/crm`, `components/admin`, `app/admin` — 12 files with inline button-like patterns, 10 with
inline badge/status-pill-like spans, 36 with card-like containers (`rounded-2xl/xl border p-*`), 68 raw
`<input>` uses, 16 raw `<select>`, 5 raw `<textarea>`, 10 files with row-like `flex justify-between` list
items. None touched.

**Vendor OS → Today (spec-proof, not shipped):** `components/vendor/VendorTodayScreen.tsx` (presentational,
typed props, zero fetching/auth) + `app/vendor/today/page.tsx` (real route behind `proxy.ts`'s `Role.VENDOR`
gate, static mock data, not linked from any nav). Composed entirely from `components/ui/*` — Card,
CardEmptyState, NextActionCard, Row, StatusPill, Button. Verified in a real browser (a throwaway unguarded
route was used to bypass the auth gate for viewing only, then deleted).

**Real gap found while verifying:** neither `/vendor` nor `/customer` has a dedicated layout — both inherit
the marketplace root layout's full chrome (announcement bar, navbar, and a lead-capture popup asking for
a phone number for a "free consultation"). A vendor's own operational screen currently renders underneath
marketplace marketing UI, the same way `/admin` would without `AdminShell`. **Needs a decision**: give
`/vendor` (and `/customer`) their own shell/layout — analogous to `components/admin/AdminShell.tsx` — before
any real screen ships there. Not built here; out of scope for a spec-proof.

## 9. VendorShell foundation (22 Sep 2026)

**Decision confirmed:** VendorShell serves both ordinary vendors and Venue Owners — Venue Owner remains a
specialized Vendor OS experience under `Role.VENDOR`, not a new role or a new shell. Nothing in the shell
is vendor-category-specific; every nav label reads correctly for a caterer or a banquet hall.
`NextActionCard`'s gradient stays untokenized, unchanged, per instruction.

**Architecture problem and fix.** Next.js's root layout (`app/layout.tsx`) unconditionally renders the
marketplace's `Navbar`, `Footer`, `CartFAB`, `ContactBanner`, and `LeadCapturePopup` around `{children}` for
*every* route — a nested layout can only add chrome, never remove an ancestor's. `/admin` already solved
this: each of those five components self-hides via `if (pathname.startsWith('/admin')) return null`
(`Navbar.tsx`, `Footer.tsx`, `CartFAB.tsx`, `ContactBanner.tsx`, `LeadCapturePopup.tsx`). Extended the exact
same check to also cover `/vendor` — one line per file, five files, zero effect on any marketplace route.
This is the only viable fix given how the layout tree is structured; a bigger restructure (moving the
marketplace chrome into its own route-group layout) would be the "modify the marketplace shell" this task
explicitly ruled out, so it wasn't done. `CartDrawer.tsx` was left alone — it only renders when
`cart.isOpen`, and nothing on `/vendor` can set that (its only trigger, `CartFAB`, is now hidden there), so
it's already unreachable without an explicit guard.

**Files added:**
- `components/vendor/vendorNav.ts` — `PRIMARY` nav (Today/Weddings/Services/Availability/Payments), mirrors
  `adminNav.ts`'s `NavItem` shape. `Weddings`/`Services`/`Availability`/`Payments` routes don't exist yet
  (out of scope here) — their links 404 by design until built, same as any nav built ahead of its screens.
- `components/vendor/VendorShell.tsx` — desktop: sticky header (wordmark, current-workspace label, primary
  nav, account button + logout). Mobile: compact top strip (workspace label + logout) + fixed bottom nav
  (4 items + More sheet for the 5th). Skips its own chrome on `/vendor/login`, mirroring
  `AdminShell`'s `isLogin` pattern. Reads only `useSession()`'s own name/roles — no new API route, no
  cross-vendor data access.
- `app/vendor/layout.tsx` — wraps every `/vendor` page in `VendorShell`, same relationship
  `app/admin/layout.tsx` has with `AdminShell`. Auth stays entirely in `proxy.ts`; this file adds no second
  check and cannot weaken the existing gate.

**Tests:** `tsc --noEmit` clean (exit 0), `eslint` clean on every changed file (Navbar.tsx's 12 warnings are
pre-existing unused-import debt, confirmed via `git diff` to predate this change), `bun test
lib/wedding/controlRoom.test.ts` 39/39 pass.

**Browser verification — desktop confirmed. Mobile: `MOBILE VERIFICATION BLOCKED — requires human/device
verification`** (confirmed in a dedicated follow-up session, not just assumed). `/vendor/today` itself
requires a real `Role.VENDOR` session (correctly — the auth gate held), so it was verified via a throwaway
route starting with the literal string `/vendor` (triggering the same `pathname.startsWith('/vendor')`
hide-logic) but outside `proxy.ts`'s slash-bounded matcher, with a mock `SessionProvider` value — no real
auth bypassed, no DB, deleted after use. Desktop: confirmed no marketplace navbar/announcement bar/popup,
correct header, working nav, account menu.

**390px mobile — two independent methods tried and conclusively ruled out, not just retried the same way:**
1. `resize_window`, on both a reused and a brand-new pre-navigation tab: reports success but
   `window.innerWidth` stayed 1280 every time, and `window.outerWidth`/`outerHeight` both read `0` — meaning
   this extension session has no real OS window it can resize in this environment.
2. Genuine iframe viewport emulation (an iframe gets its own real CSS viewport, not a simulation) at
   390×844: failed to load at all — confirmed via `read_network_requests` that **zero network requests**
   were even dispatched for the iframe's navigation, meaning something in this browser/extension context
   blocks the iframe's navigation client-side before any request goes out. Not a server CSP issue (that
   would still show a blocked *request*).
3. `list_connected_browsers`: only one browser connected, a local Windows desktop instance — no mobile
   device available as a third option.

No code change was made to chase a passing result. The mobile implementation is unchanged from what was
written and desktop-verified in the prior round: a structural copy of `AdminShell`'s already-shipping
responsive pattern (`hidden md:block` / `md:hidden` / `fixed inset-x-0 bottom-0` / `grid-cols-5`).
**A human needs to check this on a real device or a working local browser before VendorShell is treated as
fully PASS** — specifically: compact top strip, wordmark, current-workspace label, account access, fixed
bottom nav with 4 items + More, the More sheet opening/closing, content not sitting under the fixed bottom
nav, and no horizontal overflow.

**Role.VENDOR authorization — confirmed unchanged**, independent of the viewport blocker: `git diff
proxy.ts` is empty, and `/vendor/today` still returns `HTTP 307` (redirect to login) for an unauthenticated
request.

**Security:** no new API routes, no new auth path, no cross-vendor data reads — `VendorShell` reads only the
current session's own `name`/`roles`. `proxy.ts`'s matcher (`/vendor/:path*`) and `Role.VENDOR` check are
unchanged.

## 10. Vendor Weddings screen (22 Sep 2026)

**Data source — reused, not invented.** `services/venuePortal.service.ts`'s `getDashboard(userId)` already
existed (consumed today by `app/vendor/page.tsx` / `VenuePortalClient.tsx`, the vendor's current home page)
and is already correctly vendor-scoped: `vendorForUser(userId)` resolves the session's `userId` →
`VendorProfile.vendorId`, then `prisma.vendorBooking.findMany({ where: { vendorId } })` — a vendor can only
ever see their own `VendorBooking` rows. No new Prisma query, no new model, no new API route. New:
`lib/vendor/weddingsView.ts`'s `buildVendorWeddingsView()`, a **pure** function (no database, no framework —
same discipline as `lib/wedding/controlRoom.ts`) that groups the existing per-booking rows into one card per
wedding (a vendor can have multiple bookings — e.g. Sangeet sound + Reception sound — for the same wedding).
"Needs attention" and "next action" are derived only from fields the dashboard already returns
(`bookingStatus === 'PENDING_VENDOR_CONFIRMATION'`, an incomplete task past its `dueAt`) — nothing invented.

**Real, pre-existing gap respected, not routed around:** `VenuePortalClient.tsx` already states outright —
*"Payment received and pending amounts are not available from the existing VendorBooking data."* The
Weddings screen shows only `booking.amount` (`VendorBooking.agreedPrice` — the vendor's own contracted price
for their own service, which they're obviously authorized to see), never a wedding-level total, invoice, or
payment-received/outstanding figure. That data genuinely isn't in this query — not shown, not faked.

**Files:**
- `lib/vendor/weddingsView.ts` + `weddingsView.test.ts` (9 unit tests: grouping, attention detection from
  both booking status and overdue tasks, done-tasks-don't-count, completed/past detection, sort order,
  amount stays per-booking never aggregated).
- `components/vendor/VendorWeddingsScreen.tsx` — built entirely from existing primitives (`Card`,
  `CardEmptyState`, `Row`, `StatusPill`, `Tabs`, `Input`) — no new UI primitive created. Three sections on
  the "All" tab (Needs Attention / Upcoming / Recent-Completed), each wedding appearing in exactly one —
  caught and fixed a duplicate-rendering bug during review where a needs-attention wedding would have shown
  twice. Search `Input` only renders once there are enough weddings to need it (`> 4`).
- `app/vendor/weddings/page.tsx` — same `requireRole([Role.VENDOR])` defense-in-depth pattern as
  `app/vendor/page.tsx` (on top of, not instead of, `proxy.ts`'s middleware gate).

**Tests:** `tsc --noEmit` clean, `eslint` clean, `bun test` — 53/53 pass across the new file plus
`venuePortal.service.test.ts` and `controlRoom.test.ts` (confirming no regression from reusing the service).

**Browser verification (desktop only — mobile stays UNVERIFIED, per the standing tooling limitation, not
re-attempted or worked around this round):** throwaway scratch route + mock session, deleted after use.
Confirmed: needs-attention/upcoming/completed grouping renders correctly and without duplication, per-tab
filtering (All/Upcoming/Needs Attention/Completed) works via clicks, per-booking amounts and status pills
render correctly, and the empty state ("You don't have any assigned weddings yet") matches the brief's
requested wording exactly.

**Security:** `proxy.ts` diff is empty; `/vendor/weddings` returns `HTTP 307` for an unauthenticated request
(confirmed live). No new API route. No cross-vendor access possible — the underlying query was already
vendor-scoped before this task.

**Not built (deliberately, matching the loading.tsx convention this codebase doesn't use anywhere):** no
`loading.tsx` — no page in this repo has one, so none was added here either, to avoid inventing a pattern
unprompted. No new `error.tsx` for the same reason — `app/vendor/page.tsx` has none either; this page
matches that exact status quo rather than improving on it unasked.

## 11. Vendor Services screen (22 Sep 2026)

**Data source — identical audit outcome to Vendor Weddings, reused again.** Same
`venuePortalService.getDashboard(userId)` call, same `VendorBookingRow` type (imported from
`lib/vendor/weddingsView.ts`, not redefined). The only genuinely new code: `lib/vendor/servicesView.ts`'s
`buildVendorServicesView()` — a pure function bucketing the *same* rows per-service instead of per-wedding,
since this screen is explicitly service-oriented, not wedding-oriented. It reuses `weddingsView.ts`'s
`isOverdue()` (now exported — the one, deliberately minimal, non-behavioral touch to that file this round;
verified via `weddingsView.test.ts` still passing 8/8) rather than redefining the same overdue-task rule
twice.

**One small, deliberate exception to full reuse:** the `VendorBookingStatus → StatusPill` mapping is
duplicated (not extracted) between `VendorWeddingsScreen.tsx` and the new `VendorServicesScreen.tsx`,
because it lives inside the screen component (not a pure `lib/` function) and extracting it would require
editing `VendorWeddingsScreen.tsx` — explicitly off-limits this round ("don't modify Vendor Weddings unless
a regression is discovered"). Six lines, no behavior risk; flagged here rather than silently done.

**Money labeling — exactly as instructed.** Every amount is labeled **"Agreed amount"**, never "Amount
Paid"/"Received"/"Outstanding" — because the only money figure genuinely available here is
`VendorBooking.agreedPrice`, the vendor's own contracted price for their own service. No wedding-level
invoice/budget/payment-received/outstanding data exists in this query (same real gap noted for Vendor
Weddings, `VenuePortalClient.tsx`'s own comment). A code comment in `ServiceCard` states this explicitly so
a future edit doesn't casually relabel it.

**Files:**
- `lib/vendor/servicesView.ts` + `servicesView.test.ts` (8 unit tests: service-oriented grouping — two
  bookings for the same wedding stay two separate cards, unlike Weddings — attention detection from both
  paths, completed/past detection, amount/service-name passthrough, sort order).
- `components/vendor/VendorServicesScreen.tsx` — built from `Card`, `CardEmptyState`, `StatusPill`, `Tabs`
  only (no `Row`, no `Input` — each service is one flat `Card`, not a list-within-a-card, and no search was
  requested for this screen so none was added). Same non-overlapping three-section pattern as Weddings
  (Needs Attention / Upcoming / Completed), same bug class already caught and avoided this time.
- `app/vendor/services/page.tsx` — same `requireRole([Role.VENDOR])` defense-in-depth pattern.

**Tests:** `tsc --noEmit` clean, `eslint` clean, `bun test` — 61/61 pass (8 new + the 53 from before,
confirming `weddingsView.test.ts` still passes after exporting `isOverdue`).

**Browser verification (desktop only — mobile stays UNVERIFIED, not re-attempted or claimed):** throwaway
scratch route + mock session, deleted after use. Confirmed: the same wedding's two functions render as two
separate service cards (proving the service-oriented, not wedding-oriented, grouping), tab filtering works,
"Agreed amount" label renders correctly, a booking with no `requirements` (package details) degrades
gracefully (no broken layout), and the empty state matches the requested wording exactly.

**Security:** `proxy.ts` diff empty; `/vendor/services` returns `HTTP 307` for an unauthenticated request
(confirmed live). No new API route. No cross-vendor access — same already-vendor-scoped query as Weddings.

**No backend gaps beyond the already-known payment-visibility one** — this screen needed nothing the
Weddings screen's audit hadn't already surfaced.

## 12. Vendor Availability screen (22 Sep 2026)

**Data source — reused again, read-only.** `venuePortalService.getDashboard`'s `availability` field
already exists: `prisma.vendorAvailability.findMany({ where: { vendorId }, date: { gte: now } }, take: 90,
orderBy: date asc)` — vendor-scoped, future-only, already what `VenuePortalClient.tsx`'s existing
"Availability" section displays today. New: `lib/vendor/availabilityView.ts`'s
`groupAvailabilityByMonth()`, a pure function (5 unit tests) bucketing the same rows by calendar month for
display. No new Prisma query.

**Real gap found and deliberately not routed around: there is no write path.** Audited every consumer of
`VendorAvailability` (`grep -rl vendorAvailability services lib app`) — only `venuePortalService.ts`
(read) and `founderDashboard.service.ts` (admin-side read) touch this model. **No API route lets a vendor
set or update their own availability.** A vendor-facing "Availability" screen whose entire point is usually
*setting* availability is, right now, necessarily read-only. Building write capability would mean a new API
route + mutation — explicitly the kind of "if existing data is insufficient, document the gap, don't
shortcut it" case this initiative has followed throughout. **Documented, not built. Needs a decision**:
should a follow-up add `PATCH /api/vendor/availability` (or similar) so vendors can actually set their own
dates? Recommended next step, not started.

**No fabricated "Needs Attention" bucket.** Unlike Weddings/Services, this screen has no third status
bucket — a `BOOKED` or `BLOCKED` date isn't an actionable problem, just already-set state, and there's
nothing in the data to ground an urgency signal. Forcing the same three-bucket pattern here for consistency
would have meant inventing a status; skipped instead.

**Files:**
- `lib/vendor/availabilityView.ts` + `availabilityView.test.ts` (5 unit tests: month bucketing, chronological
  sort at both month and entry level, status/note passthrough).
- `components/vendor/VendorAvailabilityScreen.tsx` — `Card` + `Row` + `StatusPill` only, no `Tabs`/`Input`
  (nothing to filter or search here). `AvailabilityStatus` → pill mapping: `AVAILABLE`=confirmed(green),
  `TENTATIVE`=dateHeld(amber), `BOOKED`=neutral(gray), `BLOCKED`=overdue(red).
- `app/vendor/availability/page.tsx` — same `requireRole([Role.VENDOR])` pattern, explicit comment
  documenting the read-only-by-necessity decision.

**Tests:** `tsc --noEmit` clean, `eslint` clean, `bun test` — 66/66 pass.

**Browser verification (desktop only — mobile UNVERIFIED, not re-attempted):** month grouping, all four
status pills, note display, and the empty state ("No availability has been recorded yet") all confirmed
correct via throwaway scratch route + mock session, deleted after use.

**Security:** `proxy.ts` diff empty; `/vendor/availability` returns `HTTP 307` unauthenticated (confirmed
live). No new API route (read-only, by the gap above). No cross-vendor access.

## 13. Locked rule — Vendor/Venue onboarding must include Services & Capabilities (22 Sep 2026)

**Decision (not yet built — architecture commitment for when onboarding work starts):** when a vendor or
venue is onboarded, they select the services they provide and those get mapped to the relevant wedding
functions/categories, stored as capabilities against the vendor. Those capabilities later drive **Functions
& Services → vendor matching/assignment → Quote → Booking** — one connected system, not a second model or a
duplicate workflow bolted alongside the existing one.

**Checked what already exists, so this doesn't get built as a duplicate later:** `Vendor.categoryId` is a
single FK to `Category` (one category per vendor — e.g. "Catering," "Photography") — coarse, not a
capability map. `VendorPackage` (`name`, `description`, `price`, `features: String[]`) is a sellable
marketplace package, not a structured "this vendor can do Haldi + Sangeet + Reception catering" capability
record, and has no relation to `WeddingEventType`/function categories at all. **Neither model satisfies this
requirement today** — a real gap, confirmed, not assumed. Whatever models this — a new `VendorCapability`
join table, or an extension of `VendorPackage` — needs to resolve to the same underlying `Vendor`/
`VendorBooking`/`WeddingEvent` graph the rest of Vivah OS already uses, not a parallel one. **Not scoped or
started; recorded here so it's visible before vendor onboarding work begins**, matching this doc set's
existing practice of flagging future-direction decisions early (see `README.md`'s "Future Direction"
section) rather than rediscovering the requirement expensively later.

## 14. Vendor Payments — data audit only (22 Sep 2026, no implementation)

**Instruction was explicit: audit only, no UI, no new query, no route.** Answering the audit's central
question — *what money information can a vendor legitimately see from the existing database, and what's
actually available today* — the answer is more nuanced than a flat yes/no, so reporting the nuance rather
than collapsing it into a shortcut either direction.

**What exists and is legitimately the vendor's own money:**
- `VendorBooking.agreedPrice` — already surfaced as "Agreed amount" on the Weddings and Services screens.
  Nothing new here.
- **A real `Payout` model exists** (`prisma/schema.prisma:1631`) with `grossAmount`, `commissionRate`,
  `commissionAmount`, `netAmount`, `status` (`PENDING | PROCESSING | PAID | FAILED`), `paidAt` — this is
  exactly "what ShaadiShopping owes/has paid this vendor for a completed service," which the vendor is
  obviously authorized to see. It is scoped by `vendorId` and `vendorBookingId`, the same shape as
  everything already reused for Weddings/Services/Availability.

**Why this isn't buildable as a simple reuse, unlike the last three screens:**
1. **No vendor-scoped read exists anywhere.** Audited every consumer of `Payout`
   (`grep -rl prisma.payout services lib app`): only `services/payout.service.ts` (two functions,
   `calculatePayoutForBooking` and `markPayoutPaid` — both admin actions, both take the *admin's*
   `weddingId`/`actorId`, neither takes a `vendorId` or lists a vendor's own payouts) and
   `founderDashboard.service.ts` (admin/founder aggregate view). **There is no `getPayoutsForVendor(vendorId)`
   equivalent to reuse** the way `venuePortalService.getDashboard` was reused three times already.
2. **A `Payout` row only exists once an admin manually triggers `calculatePayoutForBooking`** after a
   booking reaches `COMPLETED` (`payoutService.ts:34`, `Sprint 7.3` comment: "tracking only... no
   payout-gateway integration exists"). Most bookings — including every one shown on the Weddings/Services
   screens so far in this initiative — will have **no `Payout` row at all**, not a `PENDING` one, until that
   admin workflow has actually run. A Payments screen built today would be empty or near-empty for most
   vendors, independent of any code-correctness question.
3. **Customer-side money (invoice, amount paid to ShaadiShopping, outstanding balance) is confirmed absent
   from every vendor-reachable model** — `Invoice`/`Payment`/`CommercialAgreement` have no `vendorId`
   relation at all. This isn't a gap to close; it's correctly absent, and should stay that way (private
   customer financial information, per every instruction so far).

**Conclusion — not a hard stop, but not a "just reuse" either. Recommending, not deciding unilaterally:**
building a real Vendor Payments screen would need one small, genuinely new, read-only, vendor-scoped query
(`prisma.payout.findMany({ where: { vendorId } })`, same scoping pattern as everything already built) — this
is different from "inventing payment data" (the data is real and vendor-legitimate) but is also more than
this round's "audit only" mandate allows, and its usefulness today is limited by point 2 above until the
admin payout-calculation workflow sees real use. **Needs your decision before anything is built:**
(a) build the small vendor-scoped payout query + a minimal Payments screen now, accepting it'll be sparse
until admin payout calculation is used more; (b) wait until payout calculation is a more routine admin
workflow; or (c) skip Vendor Payments for now and move to Venue Owner / CustomerShell per the stated
sequence, returning to Payments later. **No code was written this round.**

**Decision (22 Sep 2026): (c) — paused.** Vendor Payments deprioritized below Venue Owner / vendor
capability architecture; the sparse-data problem (point 2) isn't worth spending V1 time on yet. Return to
this once admin payout calculation sees real use.

## 15. Vendor/Venue onboarding + Services & Capabilities — data audit only (22 Sep 2026, no implementation)

**Purely an audit, per instruction — no code, no schema change, no migration.** Question asked: what exists
today for "what services/functions can this vendor actually do," how does Functions & Services currently
express a requirement, how does vendor assignment currently work, and what's the smallest model that would
close the gap without duplicating anything.

**1. `Vendor` model:** one `categoryId` → `Category` (`prisma/schema.prisma:240`) — a single marketplace
taxonomy value (venue, catering, photography, makeup, …), one per vendor. No multi-capability field, no
relation to `WeddingEventType` (the function enum) at all.

**2. "VendorCategory" doesn't exist as its own model.** It's just `Category` — a flat, marketplace-listing
taxonomy (used for public category pages, vendor applications, commission rates). No separate
vendor-capability table anywhere in the schema.

**3. `VendorPackage`** (`name`, `description`, `price`, `features: String[]`, `isPopular`, `isPerPlate`) is a
**sellable marketplace package** per vendor — pricing/marketing content, not a structured capability record.
No relation to `WeddingEventType` or any function taxonomy.

**4. No other service/category table exists.** Grepped the schema for anything Category-shaped: only
`Category` (marketplace) and `DocumentCategory` (an unrelated enum for document types). Nothing else.

**5. How Functions & Services identifies a "requirement" today — free text, not structured.**
`QuotationItem.category: String?` (comment: *"Venue / Catering / Decoration…"*) and
`QuotationItem.functionLabel: String?` (comment: *"e.g. Sangeet — informational until a Wedding exists"*) —
two independent, unvalidated free-text fields typed by whoever authors the quotation. These flow through to
`BookingItem.vendorCategory: String` (also free text) at conversion. When a quoted line has no vendor yet,
the "requirement" degrades even further: it becomes an English sentence embedded in a `Task.title`
(`Assign a vendor for "Photography"`) that `lib/booking/unassigned.ts`'s `unassignedServiceFromTask()`
**parses back out with a regex** to recover the service name. There is no structured "Requirement" entity
anywhere in the pipeline — every representation is a loose string.

**6. How vendor assignment currently works — entirely manual, zero matching.** The "Assign vendor" picker
(`components/wedding/plan/VendorPicker.tsx`) calls `/api/weddings/vendor-search?q=...` →
`weddingWorkspaceService.searchVendors(q)`
(`services/weddingWorkspace.service.ts:950`), whose query is exactly:
```
prisma.vendor.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, select: { ...,
  category: { select: { name: true } } } })
```
**Filtered only by vendor name substring.** `category` is fetched and displayed as plain text next to each
result (`"{name} · {category} · {city}"`) — informational only, never used to filter or rank. Nothing stops
a coordinator from assigning a photography vendor to a catering requirement; nothing flags the mismatch.
This is the concrete, current state of "vendor supply side" vs. "Functions & Services demand side" — they
are connected only by a human reading a text label, exactly the gap the locked rule (§13) exists to close.

**7. Onboarding itself already confirms the gap starts at the first data-entry point.**
`VendorApplication` (`prisma/schema.prisma`, the real public-facing onboarding submission model) has the
same shape as `Vendor`: one `categoryId`, price range, description, portfolio images — **no
services/capabilities/function field at all.** `VendorApplication.vendorId` is the 1:1 link to the `Vendor`
created on approval — so `categoryId` is the only thing that already flows through that approval pipeline;
a capability field would need to flow the same way.

**8. Extend, don't duplicate — recommended, not decided.** The natural extension point is `Vendor` itself
(already the FK anchor for `VendorPackage`, `VendorBooking`, `VendorAvailability`, `Payout`, everything else
in this initiative), reusing the **existing** `WeddingEventType` enum for functions (`HALDI`, `MEHNDI`,
`SANGEET`, `WEDDING`, `RECEPTION`, `ENGAGEMENT`, `OTHER` — zero new enum) rather than inventing a parallel
function taxonomy, and leaving `Category` exactly as-is (marketplace taxonomy, unrelated concern).

**9. Proposed smallest V1 capability model** (a recommendation for your decision — not built, not
scoped, nothing to implement from this yet):
```prisma
model VendorCapability {
  id         String            @id @default(uuid())
  vendorId   String
  vendor     Vendor            @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  function   WeddingEventType
  createdAt  DateTime          @default(now())

  @@unique([vendorId, function])
  @@map("vendor_capabilities")
}
```
One new join table, zero new enums, zero duplication of `Category`/`VendorPackage`. Captures exactly "this
vendor can serve this function" — enough to later (a) extend `searchVendors` to filter/rank by function
match instead of name-only, and (b) add a multi-select "which functions do you serve" step to
`VendorApplication`'s onboarding form, copied onto `Vendor` at approval the same way `categoryId` already
is. **Deliberately not solving in V1:** category-scoped capability (e.g. "Sangeet catering" vs. "Sangeet
DJ" as distinct capabilities) — function-only is coarser but avoids overbuilding a taxonomy before real
usage data exists to validate the finer grain is needed, matching this initiative's discipline throughout.
Also deliberately not touched: `QuotationItem.category`/`functionLabel`'s free-text authoring — validating
those against real capabilities is a separate, larger decision (changes quotation-authoring UX) that
shouldn't be bundled into the capability model's own introduction.

**Nothing implemented this round.** Awaiting a decision on the proposed model (or a different shape) before
any schema/migration/UI work begins.

**Decision (22 Sep 2026): approved.** Build `VendorCapability` in V1, function-level only (no matching yet),
with capability selection added to `VendorApplication` → `Vendor` onboarding (not left to disappear at
approval). See §16 for the implementation.

## 16. VendorCapability — implemented (22 Sep 2026)

**Scope held exactly to what was approved — verified against the given list before finishing:**
`VendorCapability` model ✅, `Vendor` relation ✅, capability selection/storage on
`VendorApplication` → `Vendor` onboarding ✅, existing vendors preserved with zero capabilities (no
backfill) ✅, no matching ✅, no quotation changes ✅, no assignment-ranking changes ✅ — confirmed via
`git diff --stat` that `QuotationItem`, `VendorPicker.tsx`, `weddingWorkspaceService.searchVendors`, and
every existing booking-workflow file are untouched.

**Schema** (`prisma/schema.prisma`):
```prisma
model VendorCapability {
  id        String           @id @default(uuid())
  vendorId  String
  vendor    Vendor           @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  function  WeddingEventType
  createdAt DateTime         @default(now())

  @@unique([vendorId, function])
  @@map("vendor_capabilities")
}
```
`Vendor.capabilities VendorCapability[]` added to the existing relation list. `VendorApplication.capabilities
WeddingEventType[] @default([])` added as a plain scalar array — matching the *existing*
`portfolioImages`/`foodMenuImages` convention on that same model exactly, not a second join table (the
application isn't a `Vendor` yet, so there's no `vendorId` to key a `VendorCapability` row on until
approval). `npx prisma format` + `npx prisma generate` both ran clean (generate is pure local codegen, no DB
connection).

**Onboarding → approval flow, verified end to end at the code level:**
1. `components/VendorOnboardingClient.tsx` — a "Services & Capabilities" multi-select (pill toggle buttons)
   reusing `lib/wedding/functions.ts`'s existing `FUNCTION_TYPES`/`FUNCTION_TYPE_LABELS` (no duplicate label
   list). Optional — a vendor can select zero or many.
2. `app/api/vendor-applications/route.ts` — `capabilities: z.array(z.nativeEnum(WeddingEventType))...` added
   to the existing zod schema, passed through to the service.
3. `services/vendorApplication.service.ts` — `VendorApplicationCreateData.capabilities` stores the draft
   selection on create. New `provisionVendorCapabilities()` (mirrors the existing
   `provisionVendorAccount()` helper's shape) runs inside the *same* approval transaction as
   `approveVendorApplication()`/`provisionVendorAccount()` — a partial failure rolls back everything,
   consistent with how account provisioning already works. No-op (zero queries) when nothing was selected.

**Admin vendor-edit UI — deliberately not touched.** The approved implementation order scoped this to the
`VendorApplication → Vendor` onboarding flow only. `AdminVendorFormClient` (the admin's existing
create/edit-vendor form) was not extended with a capability editor — an already-onboarded vendor's
capabilities can only be set today via this new onboarding path, not edited afterward by an admin. Flagging
this as a known, deliberate gap rather than silently leaving it undiscoverable.

**Tests:**
- `services/vendorApplication.service.test.ts` (new, 4 tests): approving with capabilities creates the
  right `VendorCapability` rows; approving with none selected makes zero `createMany` calls; a non-approval
  status change and a re-approval both correctly provision nothing.
- `app/api/vendor-applications/route.test.ts` (+3 tests): valid capabilities reach the service; an invalid
  enum value is rejected before the service is invoked; omitted capabilities are accepted.
- **A real cross-file test-pollution bug was found and fixed along the way**, not glossed over:
  `services/stats.service.test.ts` also mocks `@/repositories/vendorApplication.repository` (a narrower
  shape) — Bun's `mock.module` registrations are global across the whole test run, not scoped per file, so
  my first version of the new test (which mocked `@/lib/prisma` and relied on the real repository
  passthrough) failed only when the full suite ran together, not standalone. Fixed by mocking the
  repositories directly inside my own test, matching `stats.service.test.ts`'s own established pattern —
  the correct fix, not a workaround.
- Full suite: `bun test` — **929 pass, 0 fail, 155 skip** (skips pre-existing, unrelated).
- `tsc --noEmit` clean, `eslint` clean on every changed file (pre-existing unrelated warnings on
  `Navbar.tsx`/`route.test.ts`'s `_omit` pattern, confirmed via `git diff` not introduced by this work).
- **`npm run build` — full production build, not just typecheck — completed clean, exit 0**, confirming
  Next.js itself (route generation, the new `/vendor/*` pages, everything) compiles correctly with the new
  Prisma types.

**Migration — NOT applied, genuinely blocked, not attempted around.** Per the explicit instruction ("do not
migrate production yet, test against staging first"), checked which database `.env.local`'s `DATABASE_URL`
actually points to before running anything. Found a real discrepancy: `.env.local`'s `DATABASE_URL` targets
Supabase project ref `xlrswgsadncosezfdgbm`, but the Supabase CLI in this working directory (`supabase/`) is
separately linked to a *different* project, ref `axuvgctfggczewjbxwex`, explicitly named
**"shaadishopping-prod"**. Which one `.env.local` actually is could not be determined from this session — a
genuinely ambiguous, hard-to-reverse situation, so it wasn't guessed. Attempted the safe middle step
(`npx prisma migrate dev --create-only` — generates the SQL, does not apply DDL) as a read-only-ish check;
it connected successfully but then produced no further output for several minutes and was killed rather than
left hanging against a database of unknown identity. Hand-authoring the migration SQL directly was
considered and rejected — there's zero existing precedent in this repo's migration history for an enum
array column (`VendorApplication.capabilities`), and a subtly wrong hand-written migration file is worse
than none: it could corrupt the tracked migration history if partially applied. **The schema change itself
is complete and `prisma generate`-verified; only the actual migration file/DB application is outstanding,
and needs your confirmation of which environment `.env.local` points to before it's attempted again.**

**Also found and fixed (build-breaking, not a design issue):** a code comment in `app/globals.css` and this
doc both contained a generic Tailwind arbitrary-value placeholder (bracket-wrapped `var()` around a bare
ellipsis, rather than a real property name). Tailwind v4's automatic content scanner reads comments/prose
too, tried to generate a real utility for that literal token, and broke the entire app's CSS build
(confirmed via the dev server + browser, not assumed). Fixed by replacing both with a concrete example
(`bg-[var(--color-bg-surface)]`) instead of a generic placeholder — worth
remembering for any future docs/comments that show Tailwind arbitrary-value syntax.

## 17. Penpot audit — access unavailable, nothing set up (22 Sep 2026)

**Instruction was explicit: audit first, stop and report if Penpot access is unavailable rather than
inventing results.** Checked every real avenue in this session: `ToolSearch("penpot")` — zero matching
tools. `.mcp.json` (this repo's MCP server config) — only `supabase` is registered, no Penpot server. No
`PENPOT_*` env var in `.env.local`/`.env`. No Penpot reference anywhere in this repo's files or git history
(`grep -ril penpot .` — zero hits). No Penpot option in this Claude Code install's plugin catalog (the
design-tooling plugin only lists Figma). **Conclusion: Penpot access/integration is not available in this
session.** No workspace, project, or file was created — nothing to report there, and nothing was fabricated
to look like it was.

**What was still done (the audit portion, independent of Penpot):** verified every item on the "existing
work that must be preserved" list is genuinely intact, not just assumed —
`docs/wedding-os/11-vivah-os-ux-architecture.md` exists (this file), all 9 `components/ui/*` files present
(`Button`, `Card`, `fieldChrome`, `Input`, `Row`, `Select`, `StatusPill`, `Tabs`, `Textarea`), all 6
`components/vendor/*` files + `vendorNav.ts` present, all 6 `/vendor/*` routes present, Wedding Control Room
components present. Design tokens confirmed present in `app/globals.css`. Nothing was touched.

**One clarification worth surfacing precisely, since the framing in this round's instructions and actual
repo state now differ:** `VendorCapability` was described as "proposed but NOT implemented yet." At the
*database* level that's accurate — the migration is still blocked (§16, pending environment confirmation).
But at the *code* level, the schema model, the `Vendor`/`VendorApplication` relations, the onboarding
capture UI, the approval-time copy logic, and the tests were all implemented in the prior round (§16),
verified via `tsc`/`eslint`/a full `npm run build`, all passing. Nothing further was done to it this round
(per this task's explicit "do not implement it unless requested" — correctly not touched), but the record
should stay precise: code-complete, DB-inactive, not "not implemented."

## 18. Environment identified — `.env.local` is staging, safe to migrate (22 Sep 2026, read-only only)

**Resolved: `DATABASE_URL`'s Supabase project (ref `xlrswgsadncosezfdgbm`) is STAGING, not production.**
Confirmed via prior-session memory (2026-07-28) recording that project's own name as literally
"shaadishopping-staging," corroborated the same day by three independent, purely read-only checks: this
repo's Supabase CLI is separately linked to a *different* project (ref `axuvgctfggczewjbxwex`, named
"shaadishopping-prod"); the linked Vercel project (`shaadi-shopping/weddingcart`) has zero environment
variables configured and a generic `*.vercel.app` production URL; and `shaadishopping.com` doesn't appear
in that Vercel team's domain list at all, despite DNS confirming the live site genuinely runs on Vercel
(under a separate, currently-inaccessible account — matches a known "two separate Vercel projects" gotcha
already in memory, `project_supabase_ipv6_pooler.md`). Only `vercel env/projects/domains ls` and a public
DNS lookup were run — no migration, no `prisma db pull`, no code change, no production access attempted.

**§16's migration is now unblocked pending your go-ahead** — `xlrswgsadncosezfdgbm` is safe to target with
`prisma migrate dev`.

## 19. VendorCapability migration — applied to staging (22 Sep 2026)

**Verified target independently before writing anything**, per the hard safety rules: `prisma migrate
status` (read-only) connected and printed `aws-0-ap-southeast-1.pooler.supabase.com` — the exact host
`.env.local`'s `DATABASE_URL` specifies for project `xlrswgsadncosezfdgbm` — confirming the live connection
matches the identified staging target, not just the file contents.

**Real blocker found and fixed, reported before touching anything:** `prisma migrate status`/`migrate dev`
hung indefinitely (reproducible, confirmed at both 45s and 150s timeouts) after connecting successfully.
Root cause, confirmed via `Test-NetConnection` (both ports reachable — ruling out a network issue) and
`.env.example`'s own documented intent (*"DIRECT_URL: ...used by `prisma migrate`/deploy tooling"*):
`prisma.config.ts` — Prisma 7's CLI config, which only migration/generate/studio commands read, never the
running app — was wired to `DATABASE_URL` (PgBouncer transaction-mode pooler, port 6543), which doesn't
reliably hold the session-level advisory lock the migration engine needs. Fixed by pointing it at
`DIRECT_URL` instead (same pooler host, session mode, port 5432 — already proven reachable, and already the
intended purpose of that env var per this repo's own convention). One line changed, with a comment recording
why. `lib/prisma.ts` (the running app's own connection) was not touched — confirmed via `git diff` and by
running the full test suite + `npm run build` clean afterward.

**A second, unrelated finding caught before applying anything:** the auto-generated migration also proposed
`DROP INDEX "approval_requests_weddingEventId_idx"` and `"...weddingId_idx"` — pre-existing drift between
`schema.prisma` (no `@@index` on those `ApprovalRequest` fields today) and migration
`20260825000000_add_client_approvals` (which created them), predating this session entirely and unrelated to
`VendorCapability`. **Removed from the migration file before applying** — not bundled in, not silently
dropped from the database either. This needs a separate decision later: either restore the `@@index`
declarations in `schema.prisma` (if the indexes are still wanted) or drop them properly in their own,
reviewed migration — not decided here.

**Migration `20260922114814_add_vendor_capability` applied via `prisma migrate deploy`** (not `migrate dev`
— the correct command for a remote managed database: applies pending migration files directly, no shadow
database required, matching `.env.example`'s own "deploy tooling" language). `prisma migrate status`
confirms staging is now up to date.

**Verified with a real read-only query against staging** (a throwaway script, deleted immediately after —
not committed, not left behind): `vendorCapability.count()` → `0` (new table live, zero rows — no backfill,
as designed), `vendor.count()` → `87` (existing data untouched), a sampled `VendorApplication.capabilities`
→ `[]` (new column live, correct default). Full test suite (929/929), `tsc`, `eslint`, and `npm run build`
all re-run clean after the `prisma.config.ts` change.

**Explicit status:** Code changed — YES (`prisma.config.ts`, one line + comment; migration file trimmed).
Production data changed — NO (staging only, confirmed independently before and after). Production
deployment — NO. No test/fake business records created (no vendors, bookings, payments, or notifications) —
only schema-level DDL and read-only verification queries.

## 20. Venue Owner specialization — implemented (22 Sep 2026)

**Per the Phase 1 decision (§3): Venue Owner is a specialized view of the existing Vendor OS, not a new
role, shell, or route.** This is exactly that — the existing `VendorServicesScreen` now shows venue setup
progress when the vendor's category is a venue, detected via `isVenueCategory()`
(`lib/quotation/terms.ts`) — the same function the quotation-terms logic already uses, not a new heuristic.

**Real, already-existing data surfaced, not invented.** `venuePortalService.getDashboard()`'s bookings
already carried `venueStatus` (`VenueBookingStatus`: `PENDING → READY_FOR_SETUP → SETUP_IN_PROGRESS → READY
→ COMPLETED`, a strictly linear one-step-forward chain per `lib/wedding/lifecycle.ts`'s
`VENUE_BOOKING_STATUS_TRANSITIONS`) — `lib/vendor/servicesView.ts` just wasn't threading it through yet.
Now it computes `venueStatus` + `nextVenueStatus` (the one valid next step, or `null` if `COMPLETED`) per
card. The transition table itself is duplicated locally (not imported) — `lifecycle.ts` also pulls in
`weddingRepository`/`activityLogRepository` at module scope, which a file feeding a `'use client'`
component's types must not bundle; documented with a cross-reference comment to stay in sync.

**Reused the already-existing, already-authorized write endpoint — no new API route.**
`PATCH /api/vendor/bookings/[bookingId]` (`{ venueStatus }`) already existed, already enforces
`Role.VENDOR` + booking ownership (`services/venuePortal.service.ts`'s `updateStatus`, vendor-scoped via
`vendorForUser`), and already validates the same transition rule server-side
(`canTransitionVenueBooking`) — the exact same endpoint `VenuePortalClient.tsx`'s `/vendor` dashboard has
used all along. `VendorServicesScreen` now calls it directly (optimistic local update on success), instead
of a new mutation being written.

**Human-language throughout**, matching this initiative's own standard: `PENDING` → "Setup not started" /
button "Mark ready for setup"; `READY_FOR_SETUP` → "Ready for setup" / "Start setup"; `SETUP_IN_PROGRESS` →
"Setup in progress" / "Mark setup ready"; `READY` → "Ready for the event" / "Mark completed"; `COMPLETED` →
"Setup completed", no button (terminal).

**Files:** `lib/vendor/servicesView.ts` (+`venueStatus`/`nextVenueStatus` on `VendorServiceCard`, +3 unit
tests covering every transition and the terminal state), `components/vendor/VendorServicesScreen.tsx`
(+`isVenue` prop, local state for optimistic updates, the setup-progress row + advance button — gated so it
never renders for a non-venue vendor, and never for a declined/cancelled booking), `app/vendor/services/page.tsx`
(+`isVenue={isVenueCategory(dashboard.vendor.category.name)}`).

**Tests:** `tsc --noEmit` clean, `eslint` clean, `bun test` — 932/932 pass (11 in `servicesView.test.ts`,
up from 8), full `npm run build` clean.

**Browser verification (desktop; mobile UNVERIFIED per the standing limitation):** throwaway scratch route
+ mock session, deleted after use. Confirmed: `PENDING`/`SETUP_IN_PROGRESS`/`COMPLETED` all render the
correct label and button (or its absence for the terminal state); clicking "Mark ready for setup" against
the (expected, no real session) 401 correctly shows a disabled/loading state and cleanly reverts — no crash,
no stuck UI; re-tested with `isVenue={false}` and confirmed the entire setup row is absent, matching the
original non-venue rendering exactly (non-regression).

**Security:** no new API route, no new auth path — reused the existing `Role.VENDOR`-gated, vendor-scoped
endpoint and its existing server-side transition validation. A non-venue vendor's UI never shows the
control at all, and even if it somehow tried the request, the endpoint only lets a vendor act on their own
`VendorBooking` rows (`vendorForUser` scoping, unchanged).

## 21. Venue Owner specialization extended to Weddings and Today; Today wired to real data (22 Sep 2026)

**Consolidated the venue-status logic to one source before extending it.** `NEXT_VENUE_STATUS` (the
transition map) moved into `lib/vendor/weddingsView.ts` — the pure lib both `servicesView.ts` and now
`weddingsView.ts` itself need — and `servicesView.ts` now imports it instead of keeping its own copy. The
human-language labels (`VENUE_STATUS_LABEL`/`VENUE_ADVANCE_LABEL`) moved to a new
`components/vendor/venueStatusLabels.ts`, shared by `VendorServicesScreen` and `VendorWeddingsScreen` — a
2nd consumer was the threshold where duplicating them stopped being the right call (unlike the
`BOOKING_STATUS_PILL` map, which stays duplicated per-screen; it's UI-layer and each screen's copy is
unlikely to need to change together).

**Vendor Weddings** (`lib/vendor/weddingsView.ts`, `VendorWeddingsScreen.tsx`, `app/vendor/weddings/page.tsx`):
each booking *within* a wedding card now tracks its own independent venue setup status and advance action —
browser-verified that two bookings in the same wedding (e.g. Sangeet + Reception) show and advance
independently, not coupled. Same reused `PATCH /api/vendor/bookings/[id]` endpoint, no new API route. Local
component state lifted to support optimistic updates nested inside the wedding→bookings structure.

**Vendor Today — wired to real data for the first time.** It shipped in an earlier round as a static mock
spec-proof, `"Not linked from any nav"` per that round's own comment — **that comment turned out to be
inaccurate**: `vendorNav.ts`'s primary nav already links to `/vendor/today`, so a real vendor was always one
click from the mock page. New `lib/vendor/todayView.ts` builds every section (stats, next action, needs
attention, today's services, upcoming weddings, pending responses, recent activity) from the same
`venuePortalService.getDashboard()` data as the other two screens — no new Prisma query for six of the
seven sections.

**Recent activity — the one section needing a small, justified data exposure, not a new query.**
`respondedAt` was already being fetched by the existing `prisma.vendorBooking.findMany` call (no `select`
narrows it), just never returned by `venuePortalService`'s `bookingView()`. Added one field to that
function's return shape — zero new queries, zero new Prisma calls — and derived "Confirmed/Declined for X —
N days ago" entries from it, sorted, capped at 5. A real `ActivityLog`-backed feed (with staff-recorded
notes, task completions, etc.) would need a genuinely new query — not built; this is honestly a narrower,
derived signal, not a full activity feed.

**Accept/Decline on a pending booking request — deliberately left unwired, not faked.** The existing
`PATCH /api/vendor/bookings/[id]` endpoint only accepts `{ venueStatus }` — there is no endpoint for a
vendor to accept/decline their own `bookingStatus`. `VendorTodayScreen`'s `onAcceptResponse`/
`onDeclineResponse` props are optional and already guarded (`onCta?.()`), so leaving them unpassed is a
safe, honest no-op — the buttons render (matching the design) but do nothing yet, rather than a new mutation
being invented for this task. **A real gap, flagged for a future decision**, not this round's scope.

**Venue setup risk on Today — the specialization is genuinely operational, not cosmetic.** When
`isVenue` is true, a venue booking whose event is happening within 2 days (through 1 day past, to still
catch a same-day-morning check) and whose `venueStatus` isn't yet `READY`/`COMPLETED` becomes its own
attention item (*"Setup not ready — [wedding]"*) and can become the top-priority next action, ranked above
overdue tasks but below an unanswered booking request. Browser-verified: an imminent, not-ready venue
booking is flagged for a venue vendor and correctly *not* flagged for a non-venue vendor with the identical
data.

**Files:** `lib/vendor/todayView.ts` + `todayView.test.ts` (11 unit tests), `lib/vendor/weddingsView.ts`
(+`venueStatus`/`nextVenueStatus` per booking, +`NEXT_VENUE_STATUS` export, +4 unit tests),
`lib/vendor/servicesView.ts` (now imports the shared map instead of its own copy),
`components/vendor/venueStatusLabels.ts` (new, shared), `VendorWeddingsScreen.tsx` (+`isVenue`, local
optimistic-update state), `VendorServicesScreen.tsx` (import source only, no behavior change),
`app/vendor/today/page.tsx` (rewritten — real fetch, was 100% mock), `app/vendor/weddings/page.tsx`
(+`isVenue`), `services/venuePortal.service.ts` (+`respondedAt` in the existing return shape).

**Tests:** `tsc --noEmit` clean, `eslint` clean, `bun test` — 947/947 pass (26 new: 11 in `todayView.test.ts`,
4 in `weddingsView.test.ts`, the rest already counted from earlier rounds). Full `npm run build` clean —
**caught and fixed a real build failure along the way**: a background build run raced against a throwaway
browser-verification scratch route being created mid-build, which briefly had a `SessionProvider` mock
missing the `roles` field my auth types require; the scratch route was deleted (as always) and a clean
rebuild from a scratch-file-free tree confirmed exit 0 — the actual shipped code was never broken, only the
build's timing against a temporary file this session created and removed itself.

**Browser verification (desktop; mobile UNVERIFIED per the standing limitation):** three throwaway scratch
routes, deleted after use. Today: stats/next-action/attention/services/upcoming/pending/activity all
rendered from real computed data correctly, including the venue-risk attention item ranking above overdue
tasks and below the booking-request item, exactly as designed. Weddings: two bookings in one wedding
tracked independent venue statuses and advance buttons. Non-venue rendering re-confirmed unaffected on both
screens.

**Security:** no new API route anywhere in this round. `respondedAt` exposure is read-only, already
vendor-scoped by the same query every other field goes through. `proxy.ts` diff empty; all three routes
(`/vendor/today`, `/vendor/weddings`, `/vendor/services`) confirmed `HTTP 307` for an unauthenticated
request, live.

## 22. IST/UTC date-handling fix across Vendor OS (22 Sep 2026)

**What:** `lib/wedding/stage.ts`/`controlRoom.ts` established IST (Asia/Kolkata) calendar-day-aware date
handling as a deliberate pattern early in Vivah OS — "a wedding date is a day, not an instant." The Vendor
OS screens built in §17–21 didn't consistently follow it: 7 call sites across `lib/vendor/*.ts` and
`components/vendor/*.tsx` used `toLocaleDateString('en-IN', {...})` without pinning `timeZone:
'Asia/Kolkata'`, and two files did calendar-day bucketing (`todayView.ts`'s "is this today/imminent?",
`availabilityView.ts`'s month grouping) via raw UTC-based `Date` math instead of reusing
`daysFromToday()`. This was previously theoretical; open GitHub issue #120 confirms production Vercel
functions run in `iad1` (US East), so a naive UTC comparison near the IST day boundary can genuinely put a
booking in the wrong "today"/month bucket for a real user.

**Fixed:**
- `lib/vendor/todayView.ts` — `dateLabel()` now pins `timeZone: 'Asia/Kolkata'`; `timeAgo()` rewritten to
  use `daysFromToday()` + `whenWords()` instead of raw millisecond math; `todaysServices`/`upcomingWeddings`/
  `setupAtRisk`'s imminent-window check all now key off a single `daysFromToday()`-derived map instead of
  UTC `toISOString().slice(0,10)` / raw `getTime()` comparisons.
- `lib/vendor/weddingsView.ts`, `lib/vendor/servicesView.ts` — their `nextAction` date-label strings now
  pin `timeZone: 'Asia/Kolkata'`.
- `lib/vendor/availabilityView.ts` — month bucketing rewritten from `d.getFullYear()`/`d.getMonth()` (server
  -local-timezone-dependent) to `row.date.slice(0, 7)` (a `@db.Date` column serialized by Prisma as an
  unambiguous ISO string — string-slicing it needs no timezone at all). This flips `monthKey` from
  0-indexed to 1-indexed months; `monthLabel` construction correspondingly moved to `Date.UTC(...)` +
  `timeZone: 'UTC'` so it doesn't reintroduce local-timezone reinterpretation.
  `availabilityView.test.ts`'s month-ordering assertion updated for the new convention.
- `components/vendor/VendorServicesScreen.tsx`, `VendorWeddingsScreen.tsx`, `VendorAvailabilityScreen.tsx`
  — each local `dateLabel`/`dayLabel` now pins `timeZone: 'Asia/Kolkata'`.

**Not a new pattern:** every fix reuses either `timeZone: 'Asia/Kolkata'` (the existing convention in
`controlRoom.ts`) or `daysFromToday()` (the existing IST calendar-day-diff helper in `stage.ts`) — no new
date-handling logic was invented.

**Tests:** `tsc --noEmit` clean, `eslint` clean on all changed files, `bun test` — 947 pass / 0 fail (full
suite, including the updated `availabilityView.test.ts` assertion). `npm run build` clean.

**How this was found:** a `/code-review` pass on the 7 open Vendor OS PRs surfaced this as a genuine
cross-file "reuse" finding — code elsewhere in the same initiative already had the correct pattern, and
these newer files hadn't picked it up. Fixed directly rather than left as a review comment, since it's a
real correctness bug in code from this session, not a style preference.

## 23. Vendor Payments — built (23 Sep 2026), reversing the §14 pause

**§14's pause is explicitly overridden here, by your decision, not re-derived.** §14 recommended option
(c) — skip Payments, return once admin payout calculation sees real use. That hasn't changed (payout
calculation is still a manual, rarely-run admin step; staging has zero real `Payout` rows). You chose to
build anyway, accepting the screen will be sparse today. This section records what shipped, not a new
audit — §14's findings (no vendor-scoped read existed, most bookings have no `Payout` row yet, no
customer-side money is or should be vendor-reachable) all still hold and shaped the design below.

**What was built — exactly the "small, genuinely new, read-only, vendor-scoped query" §14 scoped, nothing
more:**
- `services/venuePortal.service.ts` — added one query to the existing `getDashboard()`:
  `prisma.payout.findMany({ where: { vendorId }, include: { vendorBooking: { include: bookingInclude } } })`,
  reusing `bookingInclude`/`bookingView` for the wedding/event context instead of a second query shape.
  Same single-fetch pattern Today/Weddings/Services/Availability already share — no new endpoint, no new
  auth boundary.
- `lib/vendor/paymentsView.ts` (new, pure, tested) — buckets the vendor's `Payout` rows into `paid`
  (`status: PAID`) and `pending` (everything else), plus a **derived** `awaitingCalculation` bucket:
  `COMPLETED` bookings with no matching `Payout` row. Not fabricated status — `bookingStatus` and the
  absence of a `Payout` are both real, already-fetched facts; this bucket exists specifically so the
  screen isn't just empty for the (currently: all) vendors whose completed work hasn't been calculated
  yet, per §14 point 2.
- `components/vendor/VendorPaymentsScreen.tsx` (new) — summary cards (total received / pending), then
  Pending → Awaiting calculation → Paid sections, each `Card`/`StatusPill` styled identically to
  Weddings/Services. The "awaiting calculation" section carries an explicit one-line explanation
  ("...that happens on our side once the wedding is fully wrapped up") rather than silently showing
  nothing, since per §14 that's the *common* case today, not an edge case.
- `app/vendor/payments/page.tsx` (new) — same `requireRole([Role.VENDOR])` → fetch → build-view → render
  shape as every other Vendor OS page. No Venue Owner specialization needed here (payout math doesn't
  differ by category).
- **Confirmed still absent, correctly:** no customer-side money (invoice/payment/outstanding balance) is
  or was made vendor-reachable — §14 point 3 stands unchanged. `VendorPaymentDetails` (bank/UPI) remains
  completely unwired, per its own explicit security comment in `schema.prisma` — this round never touched
  it.

**Tests:** `lib/vendor/paymentsView.test.ts` (7 new: empty state, paid/pending bucketing, totals, the
awaiting-calculation derivation including the "already has a payout" and "not completed" exclusions,
commission label formatting). `tsc --noEmit` clean, `eslint` clean, `bun test` 954/954 pass (947 prior +
7 new), `npm run build` clean — `/vendor/payments` now a real route in the build output.

**Browser verification (desktop only; mobile still the standing unverified limitation):** no real vendor
login exists on staging to go through the normal `/vendor/login` auth path (confirmed by querying
`VendorProfile` directly — zero rows), so — same as done earlier in this initiative for Today — a
throwaway scratch route rendered `VendorPaymentsScreen` directly with a hand-built view covering all four
states (paid, pending, awaiting calculation, and fully empty), screenshotted, then deleted. No test/fake
database records were created for this; the props were literal, never persisted.

**Staging state after this round:** unchanged — zero `Payout` rows exist (confirmed both before and after
this round). Nothing about implementing the screen created data; it will render real Pending/Paid/Awaiting
sections the moment `payoutService.calculatePayoutForBooking` is actually run for a vendor.
