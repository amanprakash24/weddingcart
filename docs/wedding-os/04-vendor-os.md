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

## 12. A business's own booking becomes its own wedding — built 10 Oct 2026

Before this a venue's (or vendor's) own flow ended at a confirmed booking with its payments; only Shaadi Shopping's bookings became
a Wedding. Now a business's confirmed booking becomes **its own wedding**, through the conversion that already existed.

**What happens**

- **Automatically** — when the payment that confirms the booking is recorded (`services/venueQuotation.service.ts` `pay`), the
  booking is confirmed and then `convertBookingToWedding` runs (`services/weddingConversion.service.ts`, unchanged rules: one
  wedding per booking however often it is asked for, only for a confirmed booking whose amount to confirm was received, under an
  advisory lock). Each is its own step: a wedding that could not be made never undoes the payment or the confirmation.
- **By hand** — a booking that was confirmed earlier (or whose wedding failed) shows **Create the wedding** on its enquiry
  (`POST /api/vendor-os/enquiries/[id]/quotation/wedding`, permission `weddings`). Pressing it twice changes nothing.
- The wedding and everything in it belong to the business: the conversion runs inside the business's scope, so the ownership guard
  puts its business on every record, and the number carries its prefix (`KUS-WED-2026-0001`). The agreement, its invoices and the
  payments already recorded move to the wedding untouched.

**What is different for a business's own booking** (and only for it — Shaadi Shopping's path is unchanged)

- Its lines are what the business itself provides: no vendor booking and no "Assign a vendor" task is made.
- The wedding gets the **functions its quotation names** on its lines (Haldi, Wedding, Reception …), each on the wedding date
  until the business sets its day; lines that name none give the one "Wedding" function (`functionsFromLabels`,
  `lib/wedding/functions.ts`).
- The enquiry it came from stays the **booked** customer on the Enquiries screen. (The conversion moves the stage to Won; "Won with
  a confirmed booking" is not "closed" — `services/venueEnquiry.service.ts`.)

**What the business sees** — `/vendor/weddings` starts with **Your Weddings** (its own, nearest date first; Shaadi Shopping's
weddings it is booked on stay below, unchanged). `/vendor/weddings/[id]` shows who and when, the stage and days to go, the
functions, what was agreed (the accepted quotation's lines, discount, GST, total), the money (agreed / received / still to come —
only for someone with `view_financials`), open tasks, and one tap back to the enquiry to record a payment. Read-only in this first
version. `services/venueWedding.service.ts`, `GET /api/vendor-os/weddings`, `GET /api/vendor-os/weddings/[id]` (permission
`weddings`).

**Tests** — `tests-db/venue.payments.test.ts` (real database: part payment makes no wedding; the confirming payment makes exactly
one, owned by the venue, with the quotation's functions; invoices and payments attached and unchanged; a manager sees it without the
money; pressing again keeps one; another venue and Shaadi Shopping see nothing), `services/venueQuotation.service.test.ts`,
`lib/wedding/functions.test.ts`. No migration.

**Not built yet**

- Changing a function's day and time, tasks and staff from the business's wedding screen (Shaadi Shopping's workspace has these;
  they are not yet opened to a business).
- The couple's signed-in page (`/customer`) still reads only Shaadi Shopping's weddings — a business's own couple uses their link (§14).

## 13. "You already have a booking on this date" — built 10 Oct 2026

A **warning, never a block**: a venue with two halls, or a caterer with two teams, takes two weddings on one day on purpose.

- **Where** — on an enquiry, above its quotation (`components/vendor/enquiries/SameDateWarning.tsx`): before the quotation is made,
  while it is out, and at the booking and its payments. When the enquiry has no date yet, the date being picked for "Make the
  booking" is checked as it is picked. A closed enquiry shows none.
- **What it says** — who has the date and whether that booking is confirmed or only accepted (not confirmed yet), each a link to
  its wedding or its enquiry. A booking never warns about itself; a closed booking does not count.
- **What it checks** — the business's OWN bookings on that whole day (`Booking.weddingDate`), read inside the business's scope, so
  another business's bookings are never counted or named (`services/venueSameDate.service.ts`, rules in `lib/venue/sameDate.ts`,
  `GET /api/vendor-os/enquiries/[id]/quotation/same-date[?date=]`, permission `quotations`). Read-only. No migration.
- **Tests** — `lib/venue/sameDate.test.ts`; `tests-db/venue.payments.test.ts` (real database: who has the date, never itself, the
  date being picked, a warning does not stop the second booking, another venue sees and is told nothing).

**Not built yet**

- It does not know about a wedding of Shaadi Shopping's that the business is booked on, or a function moved to another day.
- It does not know halls, lawns or time slots — two bookings on one date always warn, even when they do not overlap.
- The couple accepting on their link is never stopped or warned; only the business sees this.

## 14. The couple's link shows their booking and their wedding — built 10 Oct 2026

A business's own couple has no login. Their private link (`/proposal/<token>`, the one the business sends on WhatsApp) stays valid
after they accept, and until now showed only the quotation. It now also shows, read-only:

- **Your booking** — once the booking is made: the agreed total, what was received, what still confirms the booking, what is still
  to pay, and each payment the business recorded (date, method, amount).
- **Your wedding** — once the confirmed booking became a wedding (§12): its date, days to go, its functions by name (each once),
  the wedding number; and "completed", "postponed" or "cancelled" in words instead of a countdown.
- The page's status message is the same one line ("₹10,000 received. ₹20,000 more confirms your booking with …").

**How** — `services/proposal.service.ts` adds `yourBooking` to the couple's view for a business's own ACCEPTED quotation, from the
agreement's money (`loadAgreementMoney`, Money v1, unchanged) and the wedding; `lib/quotation/coupleBooking.ts` decides what the
couple may see; `components/proposal/YourBookingPanel.tsx` shows it. It runs inside the business's scope, which the link itself
resolves (`lib/quotation/proposalEntry.ts`). Shaadi Shopping's own links are unchanged (they keep their Payments view). A failure
loading it never hides the proposal. No migration.

**Never on the link** — payment reference numbers, invoice numbers, who recorded a payment, tasks, notes, another customer.

**Tests** — `lib/quotation/coupleBooking.test.ts`, `services/proposal.service.test.ts`, `tests-db/venue.payments.test.ts` (real
database: booked with nothing paid; fully paid with the wedding; no reference number or business id in what the couple receives).

**Not built yet**

- ~~The couple cannot pay or say "I have paid" on a business's own link.~~ Built 11 Oct 2026 — §17.
- Each function's own day and time (all are on the wedding date until the business can set them), tasks, documents, guests.
- The link is only shown to the business when it is made; a couple who lost it needs a new one from the business.
## 15. One price list, by kind ("What we offer") — built 7 Oct 2026

Step 1 of the Vivah OS catalog work (founder order: Unified Offerings/Catalog → Rental → Catering → Quotation integration → Payments →
Wedding Pipeline → Command Center). Before this a business had two lists feeding its quotation form: "What we offer"
(`BusinessOffering`, one card per wedding function) and the packages on its public Shaadi Shopping page (`VendorPackage`). Now there
is one.

**What a business sees** (`/vendor/offerings`, `components/vendor/offerings/OfferingsScreen.tsx`)

- Everything it sells in one list, sorted by **kind**: Venue & rentals, Food & catering, Decoration, Services, Packages, Other.
- It is shown the kinds that fit it first, from the category of its listing (`kindsForCategory` in `lib/venue/offering.ts`): a venue
  gets rentals, food, decoration, services and packages; a caterer starts with food; everyone else starts with services. The other
  kinds are one tap away under "Do you also offer something else?" — nothing is forced on anyone.
- Each item: name, **what is provided** (optional note), starting price, per plate (food and packages only), and the wedding function
  it is for — or **Any function**, which is the default.
- **Hide** keeps an item in the list but stops offering it; **Remove** deletes it. Quotations already written keep their own lines.
- Packages on its public page are listed under Packages as "On your Shaadi Shopping page" with **Add to my list** — a one-time copy
  the business can then change. Shaadi Shopping still looks after what the public page shows.

**Where the list is used**

- **Quotation form** — "Add from your price list", grouped by kind; one tap adds a line with its price and, if it has one, its
  function. Only items currently offered. A public-page package that has not been copied still appears once, under Packages, so
  nothing a business could tap before is lost (`state()` in `services/venueQuotation.service.ts`).
- **The couple's link, "Add an event"** — an item for any function can be ticked for whichever function the couple asks to add; when
  the list has such items, every function is offered. Hidden items are never shown and never accepted as a tick
  (`services/proposal.service.ts`).

**Data** — migration `20261007300000_unified_catalog` (additive): `business_offerings` gains `kind` (enum `OfferingKind`, default
OTHER), `description`, `active` (default true) and `sourcePackageId` (the public-page package a row was copied from); `function`
becomes optional. Existing rows keep their function, name and price; a per-plate row becomes Food & catering, anything else waits
under Other until the business sorts it.

**Rules** (`lib/venue/offering.ts`, shared by the form and the server) — a kind is required; at most 60 items of one kind; per plate
is kept only for food and packages; the business is always the one of the current scope (`services/venueOffering.service.ts`), so
another business's item or package is simply "not found". Needs the `catalog` permission (reading the list for a quotation:
`catalog` or `quotations`).

**API** — `GET/POST /api/vendor-os/offerings`, `PUT/PATCH/DELETE /api/vendor-os/offerings/[id]` (PATCH = hide / offer again),
`POST /api/vendor-os/offerings/from-listing`. Every answer is the whole catalog: `{ items, kinds, listingPackages }`.

**Tests** — `lib/venue/offering.test.ts`, `services/venueOffering.service.test.ts`, `tests-db/venue.offerings.test.ts` (real
database: two businesses, kinds, any-function items, hide, copy a package once, neither sees the other's).

**Not built yet (next steps, in the founder's order)**

- Rental pricing basis — per function / per day / per slot (Step 2).
- Catering menus with controlled extras (Step 3).
- Quotation lines do not yet know their kind, and a list item carries no GST rate (Step 4, quotation integration).
- The public page still shows `VendorPackage`; a business cannot yet publish its own list there.

## 16. A business plans its own wedding: functions and a to-do list — built 10 Oct 2026

The business's wedding page (`/vendor/weddings/[id]`, §12) was read-only. It is now where the wedding is planned:

- **Functions** — change a function's day, time and place; change which function it is; add one (Mehndi, Sangeet, Reception, or an
  "Other" with its own name); remove an empty one. Moving the "Wedding" function moves the wedding's date with it.
- **To do** — add a to-do with an optional "by when", tick it done, untick it, take it off the list (kept as cancelled, never
  deleted).
- **The couple's link** (§14) shows each function's day, time and place once the business has set any of them; until then it
  lists the functions by name as before. Its countdown runs to the wedding day itself. To-dos are never shown to the couple.
- A finished or cancelled wedding, or a member without the `weddings` permission, sees the page without the editing controls
  (`canEdit`) — and the server refuses the change either way.

**How** — a thin adapter (`services/venueWedding.service.ts`: `addFunction`, `updateFunction`, `removeFunction`, `addTask`,
`setTask`) over the existing wedding service, unchanged (`services/weddingWorkspace.service.ts`): an "Other" function needs a
name, only an empty function can be removed and never the last, a finished wedding is not changed, every function change is
written to the wedding's history. The form checks are `lib/venue/weddingPlan.ts` (browser-safe: no server-only imports).
Routes: `POST /api/vendor-os/weddings/[id]/functions`, `PATCH|DELETE …/functions/[functionId]`, `POST …/tasks`,
`PATCH …/tasks/[taskId]` — all `venueScoped(…, 'weddings')`, so another business's wedding is "not found". Screen:
`components/vendor/weddings/WeddingPlan.tsx`. No migration.

**Tests** — `lib/venue/weddingPlan.test.ts`, `lib/quotation/coupleBooking.test.ts`, `tests-db/venue.payments.test.ts` (real
database: move a function, add and remove one, the wedding's date follows its "Wedding" function, the couple's link shows the
schedule, the quotation and payments are untouched, the to-do list, another venue is refused, Shaadi Shopping sees nothing).

**Not built yet**

- Giving a to-do to a team member, priorities, and to-dos tied to one function.
- The same-date warning (§13) still reads the booking's date, not a function moved to another day.
- The days-to-go on the business's own page counts to the first function, while the couple's link counts to the wedding day.
- Marking the wedding completed, postponed or cancelled from this page.

## 17. The couple pays the business from their link, and the business checks it — built 11 Oct 2026

A business's own couple could accept on their link (§14) but had to be told separately where to pay, and the business typed the
payment in afterwards. Now the link carries the payment:

- **The couple's link** gets the Payments tab once the booking is made **and** the business has saved its UPI ID (Settings): the
  business's own UPI QR and "pay with a UPI app" for the amount that confirms the booking (or any amount up to what is due), then
  **"I have paid"** with the UPI reference (UTR) and an optional screenshot. The payee is the business — never Shaadi Shopping.
- **"I have paid" is a claim, never money.** Nothing is received, held or confirmed until the business says it found the money.
- **The business** sees "… says they have paid — check and confirm it" first on Your Enquiries, and on the enquiry a block with the
  amount, the UTR and the screenshot: **"Yes, I received ₹…"** records the payment exactly as "Record a payment" does (same rule,
  hold, confirmation and wedding — §12), once however often it is pressed; **"Not received"** asks for a reason, which the couple
  reads on their link.
- Only a member who may see money sees a claim (`view_financials`); only one who may record money can check it
  (`edit_financials`). Another business's claim is "not found"; Shaadi Shopping's staff see none of it.
- A business without a UPI ID, or a booking not made yet: the link is as before (no Payments tab), and a claim is refused with
  "Please contact …".

**How** — the existing claim flow, unchanged in its rules (`services/paymentSubmission.service.ts`, 08-quotation.md §20: at most
three open claims, a UTR is never taken twice, verifying goes through `recordPaymentForQuotation` with `sub-<id>` as its
idempotency key). What is new is who is paid and who checks: `forProposal` / `submit` take the payee
(`upiPayeeOf`, `lib/payments/upi.ts` — the business's UPI ID under the name it typed, else its own name);
`services/proposal.service.ts` names it for a business's own quotation and strips the reference numbers from the receipts the
couple sees (on a business's own booking those are whatever the business typed); `venueQuotationService.checkClaim` and
`booking.claims`; `POST /api/vendor-os/enquiries/[id]/quotation/claims/[claimId]` (`{ received: true }` or
`{ received: false, reason }`); `PAYMENT_TO_CHECK` in `lib/venue/enquiry.ts`. A claim belongs to the business through its
quotation (`lib/ownership/owned.ts`), so the database guard keeps it to that business. No migration.

**Tests** — `lib/payments/customerPayment.test.ts`, `lib/venue/enquiry.test.ts`, `services/proposal.service.test.ts`,
`services/venueQuotation.service.test.ts`, `tests-db/venue.payments.test.ts` (real database: no payment before the booking; a
claim changes no money; a manager without money permission, another venue and Shaadi Shopping do not see or check it; not found
shows the reason; found records one payment, confirms the booking and makes the wedding, pressed twice or not).

**Not built yet**

- Nobody checks that the UPI ID a business typed is really its own — the couple is told to check the name in their UPI app.
- "It arrived, but a different amount": mark it not received with the reason, or record the payment by hand.
- ~~No message to the business when a claim arrives, and none to the couple when it is checked.~~ See §18 for what was added
  and what is still missing.
- Card / net-banking payment and automatic matching with the bank.

## 18. Telling the business about "I have paid", and the couple about the answer — built 11 Oct 2026

§17 left both sides to find out by opening their own page. Nothing is sent by the app here — there is no approved WhatsApp
template for it (see below) — so this adds what works without one:

- **A mark on "Enquiries" in the menu**, on every Vendor OS screen: the number of claims waiting ("Enquiries — 1 payment to
  check"). Only for a member who may see money. It is asked again on every screen change and the moment a claim is checked.
- **The couple's link:** each claim still being checked has **"Tell <business> on WhatsApp"** — a ready message (amount,
  quotation number, UTR, their name) to the business's own number, sent from the couple's own WhatsApp. Only on a business's own
  link, and only when the business has a number (D8); Shaadi Shopping's own links are unchanged.
- **The business's enquiry:** after "Yes, I received" a **"Tell <name> on WhatsApp"** button with a ready thank-you (and
  "your booking is confirmed" when it is); beside a claim marked not received, the same with the reason.

**How** — `GET /api/vendor-os/enquiries/to-check` (`venueEnquiryService.paymentsToCheck`, a count through the ownership guard);
the mark in `components/vendor/VendorShell.tsx` (`TO_CHECK_CHANGED` in `vendorNav.ts`); the three message texts in
`lib/payments/claimMessages.ts` (pure, browser-safe); the links in `components/proposal/PaymentsPanel.tsx` and
`components/vendor/enquiries/BookingMoney.tsx`. No migration.

**Tests** — `lib/payments/claimMessages.test.ts`; `tests-db/venue.payments.test.ts` (the count: 1 with a claim waiting, 0 for a
manager without money permission and for another venue, 0 once every claim is checked).

**Not built yet**

- **A message the app sends by itself.** `lib/whatsapp.ts` can send through Shaadi Shopping's WhatsApp Business number, but
  WhatsApp delivers a free-text message only to someone who wrote to that number in the last 24 hours; anything else needs a
  message template approved by Meta (as the login OTP has). A "payment to check" template has to be created and approved first.
- The mark only shows while Vendor OS is open; there is no notification on the phone.
- The couple's message depends on the couple tapping the button.

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
