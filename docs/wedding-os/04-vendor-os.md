# Vendor OS — Functional Design

The deep specification of the Vendor Dashboard sketched at summary level in
`01-command-center.md` §4.4 — same relationship as `03-wedding-workspace.md` was to
the original one-paragraph "Wedding Command Center" idea. This module is the direct
implementation of the Vendor role as originally defined in Part 1: **"Manage
profile, Update prices, Block dates, Confirm bookings, View earnings."** Every
section below maps to one of those five verbs.

## 1. Purpose

Give vendors enough self-service control that Operations/Sales stop being a manual
relay between "customer wants X" and "is vendor Y available/willing/priced right."
Every vendor interaction currently requires an admin to touch the `Vendor` record on
their behalf (`/admin/vendors/[id]`) — this module replaces that with the vendor
managing their own profile, calendar, and pricing directly.

## 2. Vendor Profile Self-Service ("Manage profile")

Editable by the vendor directly: description, images/gallery, packages (§5),
address, map location, FAQs.

**Needs a moderation decision, flagged not resolved:** should every self-service
edit go live immediately, or do some changes (category change, business name
change) need admin review first? Minor edits (photo swaps, description tweaks)
going live immediately seems low-risk; category/name changes plausibly warrant
review given they affect how the vendor surfaces in public search. Propose: minor
fields self-service immediate, category/business-name changes create a pending
change for admin approval — same shape as the existing `VendorApplication` review
flow, reused rather than inventing a second approval mechanism.

## 3. Availability & Calendar ("Block dates")

The `VendorAvailability` entity (named as a gap in every prior doc in this set —
finalized here since this is its natural home) needs, per date: a state —
`AVAILABLE` / `TENTATIVE` / `BOOKED` / `BLOCKED` (vendor manually marked
unavailable, e.g. personal leave).

**How it interacts with bookings:** when a `VendorBooking` (from
`03-wedding-workspace.md` §5, joining a `WeddingEvent` to this `Vendor`) is
created against a date, that date's availability auto-transitions to `TENTATIVE`
(pending vendor confirmation, §4) and then `BOOKED` on confirmation. A vendor
manually blocking an already-`BOOKED` date should be prevented — surface the
conflict, don't silently overwrite a real booking. This conflict check is exactly
what powers the "vendor availability conflicts" alert already specified in
`01-command-center.md` §5.

**Calendar view** aggregates across every `WeddingEvent` the vendor is booked
against — a vendor works with many different weddings, so their calendar is the
union of all their `VendorBooking` dates plus manually blocked dates, not scoped to
one wedding. This is the same underlying data as Wedding Workspace §5's
vendor-assignment view and the Founder Dashboard's cross-category Vendor
Availability widget — three different views (vendor's own calendar, one wedding's
vendor list, business-wide availability summary) of one `VendorBooking`/
`VendorAvailability` dataset, not three separate data stores.

## 4. Booking Requests & Confirmation ("Confirm bookings")

When Operations/Sales creates a `VendorBooking`, it starts in
`PENDING_VENDOR_CONFIRMATION` — the vendor must actively accept or decline, not have
a booking silently assumed. Time from request-created to vendor-response is tracked
and directly feeds the "response time" component of the Vendor Score (§7) — this is
the actual mechanism behind that KPI, not a separate measurement.

Decline should require a reason (date conflict, price disagreement, etc.) — useful
both for the requesting coordinator (do they need to find a replacement vendor
immediately) and for the vendor's own cancellation-rate tracking in §7.

## 5. Package Management ("Update prices")

**Already real, already migrated:** `VendorPackage` exists in the Phase A schema
and has a working repository (`repositories/vendor.repository.ts`, Milestone 2) —
this section is almost entirely UI/permissions work, not new data modeling. Vendor
gets full CRUD on their own packages (name, description, price, features,
`isPopular`, `isPerPlate`, image) scoped to `vendorId = self`, same
`findMany`/`create`/`update`/`delete` interface every other repository in this
codebase already follows.

## 6. Earnings & Payouts ("View earnings")

Needs a `Payout`/`Commission` entity (named as a gap in `01-command-center.md` and
`03-wedding-workspace.md`, specified here). Per `VendorBooking`: agreed price,
platform commission (percentage — **rate itself is a business decision, not a
technical one, flag for the founder rather than assume a number**), net vendor
payout, payout status (pending/processing/paid), payout date.

**Payment timing is also a business decision to flag, not assume:** does the vendor
get paid when the customer pays the deposit, when the event completes, or on some
fixed cycle (weekly/monthly)? This materially affects vendor trust and cash flow and
shouldn't be decided implicitly by whatever's easiest to build.

Vendor sees: total earned (lifetime/this month), pending payouts, payout history —
directly mirrors the Vendor Dashboard's Earnings widget in `01-command-center.md`
§4.4, now with the underlying entity actually specified.

## 7. Reviews & Vendor Score

**Reviews:** needs an individual `Review` entity (currently `Vendor.rating`/
`reviewCount` are bare aggregate numbers with nothing behind them — flagged in
`01-command-center.md`). Once real `Review` records exist, `Vendor.rating`/
`reviewCount` should become **computed-on-read**, not stored/denormalized —
consistent with the pattern already established for `Category`'s vendor count in
Phase A (recomputed live via aggregation, not trusted as a stored field, per
`docs/postgres-migration-plan.md`). Same principle, same reason: a derived number
that can drift from its source is worse than recomputing it.

**Vendor Score** (named twice already — the original Part 1 vision and
`01-command-center.md`'s Founder Dashboard "Vendor Performance" widget — fully
specified here for the first time): a composite score from booking acceptance rate
(§4), average response time (§4), review rating (this section), cancellation rate
(§4's decline tracking), on-time service rate (needs a post-event
confirmation/flag, not yet modeled elsewhere — smallest new gap in this doc), and
repeat booking rate (same customer/coordinator booking the same vendor again).

**Proposed v1: deterministic weighted formula, same pattern as every other scoring
concept in this doc set** (CRM lead priority, Wedding Health Score) — ship
something explainable, let `07-ai-assistant.md` propose a smarter version once
there's real data. Used to power the Founder Dashboard's Vendor Performance ranking
and, eventually, "AI vendor recommendations" (named in the original Part 3 outline,
owned by the not-yet-written AI Assistant doc).

---

## 8. Proposal view ("See my accepted work") — built 29 Sep 2026 (PR #135)

Read-only view, behind vendor login, of the part of an **accepted** quotation that belongs to this vendor
(08-quotation.md §15 D4). Not a new model: a projection of the existing Quotation (`services/vendorProposal.service.ts`,
`lib/quotation/vendorProposal.ts`). Pages: `/vendor/proposals` (list, linked from the portal nav) and
`/vendor/proposals/[quotationId]`. No API route, no actions, no writes, no migration.

**ACCEPTED = vendor access begins. BOOKED = the accepted proposal has progressed to a booking; access continues.**
Visible when the quotation is `ACCEPTED` **and** has at least one line with this vendor — nothing else is checked. A
booking made from it only changes the label (*Accepted by the couple* → *Booked*); it is not a second requirement, and
later changes to the booking or the CRM record (e.g. booking closed, enquiry lost) do not remove access.

| Quotation | Vendor |
|---|---|
| DRAFT · SENT · SENT in negotiation · EXPIRED · REJECTED · SUPERSEDED | Hidden — one generic 404 |
| ACCEPTED, no booking | Visible — *Accepted by the couple* |
| ACCEPTED with a booking (any booking status) | Visible — *Booked* |

Another vendor's quotation or an unknown/malformed id is the same 404 — the page never reveals whether a quotation exists.

**Shown:** couple/wedding name, wedding date, guest count, city, event type · the vendor's own lines (category, function,
description, quantity, unit price, line total) · the agreed amount = the sum of those lines · once a wedding exists, date,
time and venue of only the functions this vendor is booked for (same rule as the existing portal).

**Never shown:** other vendors (names, ids, categories, lines, prices), quotation subtotal/total, discount, GST, advance,
balance, terms, inclusions/exclusions, internal notes, proposal link/token/hash, couple's view time, change requests,
acceptance channel/note/date/who, customer phone/email/id, CRM stage/owner/lost reason, lead/consultation/enquiry ids,
agreement snapshot, invoices, internal wedding number.

**Isolation (server-side):** the vendor is always the logged-in user's own vendor (`vendorForUser`), never an id from the
request · the database query only matches quotations with a line of that vendor and only selects that vendor's lines ·
the projection re-checks each line's vendor and outputs an explicit allow-list · `proxy.ts` admits only the VENDOR role
to `/vendor/*`, and each page checks it again.

**Amount:** the agreed amount for the vendor's quoted items (price × quantity), as quoted. Commission tiers are a
separate, later feature and are not applied here.

## 9. Vendor enquiry & response ("Can you take this wedding?") — built 30 Sep 2026 (blueprint §43, Roadmap 1.1)

When staff link a vendor to a customer — choosing them on the consultation, or on a quote line when a draft is saved
— the vendor is **asked automatically** (`VendorEnquiry`, one per vendor per customer record; migration
`20260930120000_add_vendor_enquiry`). A revision or re-save refreshes a still-pending enquiry (never a duplicate);
removing the vendor from both the consultation and the quote **withdraws** it; linking them again asks again. An
answered enquiry is never changed by a later save.

**What the vendor sees before acceptance:** date, city, guests, event type, the service(s) and function(s) — never the
couple's name or contact details, other vendors or the customer price (`toVendorEnquiryView` allow-list).

**Answers:** Available · Available with conditions (conditions required) · Not available · Suggest another date (date
required) · Sent a quote (amount or note). Given by the vendor in Vendor OS (`/vendor/enquiries`), or recorded by
staff on the vendor's behalf with the channel (phone / WhatsApp / in person / other) — same validation either way.
Only 1 vendor has a login today, so staff recording is the main path until more vendors onboard.

**Never blocks sales:** saving, sending, accepting and booking a quote never read enquiries (guard test); the sync runs
after the save, best-effort (`lib/vendorEnquiry/hook.ts`). **Staff alerts** (in-app until Block 3 notifications): the
lead's "Vendor availability" card warns on *Not available* and *another date*; the timeline records "Enquiry sent" and
"<vendor> answered …". **The customer never sees any of it** (guard test on the proposal page and its data).

## 10. Vendor login code ("Mobile number + 6-digit code") — built 6 Oct 2026

Founder decision, 6 Oct 2026: registration stays short; when Shaadi Shopping accepts it, the system issues a **6-digit login
code**; the team shares it with the vendor together with the terms paper; the vendor signs in at `/vendor/login` with **the
mobile number given at registration + the code**. No message is sent and nothing is paid per sign-in.

**Where the code comes from**
- **On acceptance** ("Approve & List" on a registration): the code is issued in the same transaction that creates the vendor and
  its login, and comes back **once** in the answer (`loginCode`, beside the application, never inside it). The admin card shows
  it with a copy button and says it will not be shown again.
- **Later** (a lost code, or a vendor from before codes existed): "New login code" on the same card —
  `POST /api/vendors/[id]/login-code` (admin only). The old code stops working and the vendor is signed out on every device
  (`User.sessionVersion` + 1).
- There is no self-service reset: a vendor who forgets the code calls Shaadi Shopping.

**Changing it:** Settings → "Login code": current code, new code twice (`POST /api/vendor-os/login-code`). The vendor stays signed
in. A code may not be one digit repeated or a straight run (111111, 123456, 654321). Changing is **optional**: once a code is
30 days old every Vendor OS screen shows one line, "Your login code is more than 30 days old. Change it now", which can be put
away until the browser is closed. Nothing is ever blocked.

**Protection**
- Only a **bcrypt hash** is stored (`VendorProfile.loginCodeHash`, `loginCodeSetAt`); the code is readable only in the one answer
  that issues it. A six-digit code has a million possibilities, so the hash alone would not survive a leaked database — the
  protection that matters is the lock below, and the code is one of two things needed (with the registered number).
- **Five wrong tries in 15 minutes lock that number** (`vendor-code:<mobile>` in `login_attempts`); a locked number is refused
  before anything is looked up, even with the right code. Changing a code has its own lock (`vendor-code-change:<user>`).
- One answer for every kind of "no" — wrong code, unknown number, a number with no code, a customer's number, a locked number —
  so the page never reveals which numbers are registered.
- Codes are drawn from `crypto.randomInt`.

**Data:** migration `20261006100000_add_vendor_login_code` — two nullable columns on `vendor_profiles`; additive. Existing vendor
logins have no code until an admin issues one. **Sign-in:** NextAuth provider `vendor-code` (`lib/auth/auth.ts`); the session is
the same as before (roles, `vendorId`, session version).

**What changed for existing logins:** `/vendor/login` no longer offers the WhatsApp one-time code. The `otp` provider itself is
unchanged (customers use it), so a vendor's number can still receive a one-time code on the customer login page.

**New-registration notice:** the founder chose a count inside the admin dashboard and no email or WhatsApp send. The dashboard
already had a banner for new registrations (`stats.newOutsideVendors`); this slice adds the count beside "Vendor applications" in
the admin menu (`AdminShell`, read from `GET /api/vendor-applications?status=new` on every screen change).

**Tests:** `lib/auth/vendorCode.test.ts` (number and code shapes, guessable codes, the change form, the reminder),
`services/vendorLoginCode.service.test.ts` (sign-in, every "no", the lock, issue, change, status),
`services/vendorApplication.service.test.ts` (acceptance issues a code and stores only its hash),
`app/api/vendor-os/login-code/route.test.ts` (who may call; nothing but dates and flags leaves the server) and
`tests-db/vendor.login-code.test.ts` (a real database and the real lock).

**Next:** the first-login profile — §11.

## 11. Business profile on first sign-in ("Name, logo, photos, video, GST number") — built 6 Oct 2026

Founder decision, 6 Oct 2026: the registration form stays short; the depth is collected **after** acceptance. The first time a
vendor signs in, Vendor OS leads to `/vendor/profile` and stays there until the profile has **a name, a logo and at least three
photos**. A video and a GST number are optional. The profile is the letterhead of the business's documents.

**What the vendor fills**
- **Business name** — the name on its documents (`Business.name`). The public listing's name stays Shaadi Shopping's to set.
- **GST number** — optional. Checked against the GSTN's own scheme: 15 characters, a state code 01–38, and the 15th character is
  a check character over the first 14, so a mistyped number is refused here rather than printed on an invoice.
- **Logo** — one image.
- **Photos** — 3 to 12.
- **Video** — one upload, or a YouTube / Instagram link (no storage used).

**"Keep items so that we do not get too much load"** — every bound is in `PROFILE_LIMITS` (`lib/venue/profile.ts`):

| Item | Limit |
|---|---|
| Image file | JPEG / PNG / WebP, decided from the file's own bytes, under 4 MB |
| Stored photo | scaled down to fit 1600 px before it is kept; logo 600 px |
| Photos per business | 12 |
| Video | 60 seconds and 50 MB — measured after it lands; an oversized one is deleted and refused |
| Uploads | 40 per business per 15 minutes |

A large phone photo is scaled down in the browser before it is sent, so the vendor never has to resize anything by hand.

**Approval before the public listing** (founder's choice): a photo or video is usable at once on the business's **own**
quotations and proposal links, and appears on its **public** Shaadi Shopping listing only after an admin approves it. New uploads
are `PENDING`; the admin "Vendor applications" tab shows them grouped by business with Approve / Reject. Approve copies a photo
into `Vendor.images` (an uploaded video into `Vendor.virtualTourVideo`; a link is only marked approved — the listing plays files).
Reject keeps it off the listing; the vendor keeps it for their own documents. A decision is final. A vendor who removes an
approved photo or video takes it off the listing too.

**Rules**
- Owner only; staff of the business can read the profile.
- Only **our own uploads** are ever saved: an address must be in our Cloudinary cloud under `shaadishopping/vendor-profile`
  (`isOwnUpload`). An address a browser merely sends is refused.
- Nothing is stored before the checks: the upload routes first ask "may this login change the profile, and is there room?".
- The folder and file name are chosen on the server; nothing about where a file is stored comes from the request.
- `Business` and `BusinessPhoto` are not owned tables, so `services/venueProfile.service.ts` names the business on every read
  and write; another business's photo is simply "not found".

**Data:** migration `20261006130000_add_business_profile` — `businesses.logoUrl`, `gstin`, `videoUrl`, `videoStatus`; table
`business_photos`; enum `BusinessPhotoStatus`. Additive.

**API:** `GET/PUT /api/vendor-os/profile`; `POST …/profile/logo`; `POST …/profile/photos`, `DELETE …/profile/photos/[id]`;
`POST …/profile/video-signature`, `PUT/DELETE …/profile/video`; admin `GET /api/admin/profile-media`,
`POST /api/admin/profile-media/photos/[id]`, `POST /api/admin/profile-media/videos/[businessId]`.

**The gate** is in `VendorShell`: it asks for the profile once per screen; with something missing (and an Owner login) it sends
the vendor to `/vendor/profile` and puts the navigation away. It is a guide, not a lock — the APIs behind the other screens do not
refuse an incomplete profile.

**Tests:** `lib/venue/profile.test.ts` (GST number, links, own-upload check, completeness), `services/venueProfile.service.test.ts`
(both halves), `app/api/vendor-os/profile/routes.test.ts` (order of checks, who may call) and `tests-db/venue.profile.test.ts`
(two real venues and the review).

**Not built yet:** the logo, GST number and photos **on** the quotation and invoice (the quotation rework), areas and
specifications of a venue, and a GST line on documents.

## Data model gaps

| Concept | First named in | Detail here |
|---|---|---|
| `VendorAvailability` | `01-command-center.md` | Finalized: `AVAILABLE`/`TENTATIVE`/`BOOKED`/`BLOCKED` states, auto-transitions from `VendorBooking` lifecycle |
| `VendorBooking` status flow | `03-wedding-workspace.md` | Adds `PENDING_VENDOR_CONFIRMATION` as the real starting status, with a required decline reason |
| `Payout`/`Commission` | `01-command-center.md`, `03-wedding-workspace.md` | Finalized shape here — commission %, payout status/date. **Commission rate and payout timing are open business decisions, not resolved by this doc** |
| `Review` (individual records) | `01-command-center.md` | Finalized: individual reviews, with `Vendor.rating`/`reviewCount` becoming computed-on-read (same pattern as `Category`'s vendor count) |
| On-time service flag | **New, this doc** | Smallest new gap — needed for Vendor Score's "on-time" component, not modeled anywhere else yet |
| Profile-change approval queue | **New, this doc** | Only for category/business-name changes — proposed to reuse the existing `VendorApplication` review mechanism rather than build a second one |

## Relationship to other modules

- **To `01-command-center.md`**: this doc is the full specification behind the
  Vendor Dashboard row (§4.4) and the Founder Dashboard's Vendor Performance widget.
- **To `03-wedding-workspace.md`**: shares the `VendorBooking`/`VendorAvailability`
  entities directly — Wedding Workspace §5 is the *wedding's* view, this doc is the
  *vendor's* view, of the same data.
- **To `06-finance.md`** (not yet written): `Payout`/`Commission` here is the
  vendor-facing half; Finance owns the company-wide reconciliation (GST, aggregate
  commission revenue, cash flow).
- **To `07-ai-assistant.md`** (not yet written): Vendor Score is specified here as
  rules-based v1, the AI Assistant doc's eventual upgrade target — same as CRM lead
  scoring and the Wedding Health Score.

## Future enhancements

- Vendor-side messaging/notifications when a new booking request arrives (push/WhatsApp)
- Bulk availability management (block a date range, not one date at a time)
- Vendor-facing analytics beyond earnings (which packages convert best, review trends)
