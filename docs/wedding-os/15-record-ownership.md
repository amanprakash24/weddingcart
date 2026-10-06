# 15 — Record ownership: one system for Shaadi Shopping *and* each venue's own business

*Design — 3 Oct 2026. **All nine decisions (D1–D9) approved 4 Oct 2026, as recommended.** Step 3 of the approved audit order
(MASTER-GAP-ANALYSIS §2.9).*

## 1. The problem in one paragraph

Every customer record in Vivah OS — enquiry, customer, quotation, booking, wedding, invoice, payment — belongs to **Shaadi
Shopping's staff**. There is no way to say "this enquiry belongs to Swayamvar Hall". So a venue cannot add the enquiry it got on the
phone, cannot quote it, cannot take the advance, cannot run the wedding. The audit brief's test (§26 — "a venue owner receives an
enquiry on their phone, taps **+ New Enquiry**…") is impossible today, and so is the blueprint's Route B (Vendor OS sold as SaaS,
§12) — there is nothing to sell. This document decides **who owns a record**, **who can see it**, and **how the code enforces it**,
before anything is built.

## 2. What the blueprint already decided (not reopened here)

- Two commercial routes: **Commission Partner** (10 / 12 / 15%) and **Independent SaaS** (₹2,999 / 5,999 / 10,999 a month), or
  **Both**, **Marketplace only**, **Inactive** — stored as structured data (§10–13).
- "If a vendor does not want to pay commission, the relationship can move to SaaS instead of being lost" (§13).
- Vendor OS is a real, standalone business system: CRM → quotation → booking → customers → team → finance (§28).
- The customer never sees internal notes, commission, negotiations or vendor responses (§43).

## 3. What exists today (verified 3 Oct 2026)

| Fact | Where |
|---|---|
| A login is a `User` with roles (`SUPER_ADMIN`, `SALES`, `OPERATIONS`, `VENDOR`, `CUSTOMER`) | `UserRole` |
| A vendor login is tied to exactly **one** vendor, and a vendor to exactly **one** login (both columns unique) — no venue staff | `VendorProfile` |
| Staff screens and APIs check only "is this a staff role" | `requireRole(ADMIN_ROLES)` on every CRM / wedding route |
| ~190 places read or write the records that would need an owner | services + repositories (lead 17, enquiry 17, consultation 17, quotation 20, booking 17, wedding 25, invoice 19, payment 15, task 19, activity 10, guest 12) |
| Numbers are global: `QTN-YYYYMM-NNNN`, `INV-…`, `WED-YYYY-NNNN` | `documentNumber.service` |
| Money goes to Shaadi Shopping (UPI from env in PR #149; Razorpay keys are Shaadi Shopping's) | — |

## 4. The design

### 4.1 One new idea: a **Business**

Every record belongs to exactly one **Business**. Shaadi Shopping is a business; each venue or vendor that uses Vivah OS is a
business.

```
Business ─┬─ members (logins with a role in that business: Owner, Staff)
          ├─ commercial status (Commission Partner / SaaS / Both / Marketplace only / Inactive)
          ├─ its Vendor profile (the public listing), if it has one
          └─ owns: enquiries, customers, quotations, bookings, weddings, invoices, payments, tasks, guests …
```

- **Shaadi Shopping** = business #1. Every record that exists today is moved to it — nothing about today's data changes meaning.
- A **venue** (e.g. Swayamvar Hall) is a business with its public `Vendor` listing attached.
- In the product it is never called "tenant" or "organisation": the venue sees **"Your business"**.

Rejected alternative: an `ownerVendorId` column on each table (null = Shaadi Shopping). It looks smaller, but it cannot hold venue
staff, a SaaS plan, a GSTIN or a payee, and "null means Shaadi Shopping" is exactly the kind of hidden rule that leaks data.

### 4.2 Logins: owners and staff

- A login can belong to **one or more** businesses, each with a role: **Owner** (everything, including money and staff) or
  **Staff** (enquiries, quotations, weddings; not settings or payouts).
- Shaadi Shopping's existing roles become its members: SUPER_ADMIN → Owner; SALES / OPERATIONS → Staff (their current limits stay).
- `VendorProfile` becomes a membership; the one-login-per-vendor limit goes away, so a venue can add its manager and coordinator.
- A login that belongs to two businesses (rare: a vendor who also works for Shaadi Shopping) picks which one it is working in,
  shown at the top of every screen. One business at a time — never a mixed list.

### 4.3 Which records carry the owner

| Carries `businessId` directly | Inherits from its parent (never set separately) |
|---|---|
| Lead, Enquiry, Consultation (the enquiry) | notes, tasks, activity → their enquiry / wedding |
| Quotation | quotation lines, revisions → their quotation |
| Booking, CommercialAgreement | booking items |
| Wedding | functions, vendor bookings, guests, RSVPs, milestones, approvals, documents → their wedding |
| Invoice, Payment, PaymentSubmission | invoice lines → their invoice |
| Review (the business that ran the wedding) | — |

The owner is set **once, when the record is created**, from the logged-in business, and never changes (moving a customer between
businesses is not a feature; it would be a support action, logged).

### 4.4 Where an enquiry came from — and commission

Every enquiry also records its **source**: *Shaadi Shopping* (the website, a Shaadi Shopping salesperson, a Growth Partner) or the
venue's **own** (phone, walk-in, WhatsApp, Instagram, Google, reference, existing customer).

- **Commission applies only to bookings that came from Shaadi Shopping.** A venue's own booking never pays commission.
- A Shaadi Shopping enquiry for a venue stays **owned by Shaadi Shopping** (it brought the customer); the venue works it through
  the existing vendor enquiry → proposal → booking flow and sees it in its own workspace as "From Shaadi Shopping".
- **The same couple from both sides** (they enquired on Shaadi Shopping and also called the venue): when a venue adds an enquiry
  whose mobile matches an open Shaadi Shopping enquiry *for that same venue*, the venue is told "This couple came to you through
  Shaadi Shopping" and the two are linked — commission applies. The venue learns nothing about Shaadi Shopping's other customers;
  Shaadi Shopping learns nothing about the venue's other customers. *(Decision D4.)*

### 4.5 Who sees what

| | Shaadi Shopping staff | Venue owner / staff | Couple |
|---|---|---|---|
| Shaadi Shopping's own enquiries & weddings | ✅ all | only the parts they are booked on (as today: availability requests, accepted proposals, their vendor bookings) | their own, via their link / portal |
| A venue's **own** enquiries, customers, quotes, weddings, money | ❌ **private to the venue** *(D3)* — only counts for the founder (e.g. "Swayamvar Hall: 12 enquiries this month") | ✅ all of their business | their own |
| A Shaadi Shopping–sourced booking at the venue | ✅ | ✅ (it is their booking) | ✅ |
| Commission, payouts, internal notes, vendor responses | Shaadi Shopping only | their own payouts only | never |

**Support access:** if a venue asks Shaadi Shopping for help with their data, the venue owner switches on temporary access
(24 hours), and every view is logged in the venue's own activity log. Shaadi Shopping cannot switch it on itself. *(D3.)*

### 4.6 Per-business details

- **Numbers** per business with its own prefix: Swayamvar Hall's quotations `SWY-QTN-2026-0001`, invoices `SWY-INV-…`;
  Shaadi Shopping keeps today's `QTN-` / `INV-` / `WED-`. *(D6.)*
- **Money goes to the business that owns the booking**: each business has its own UPI ID / payee name (PR #149 reads it from the
  business instead of the environment) and, later, its own GSTIN for invoices.
- **The couple's link** for a venue's own quotation shows **the venue's name and logo**, with a small "Powered by Vivah OS".
  Shaadi Shopping's quotations look exactly as today. *(D8.)*

### 4.7 How the code enforces it (the part that must not leak)

> **Changed 4 Oct 2026 (approved): central enforcement.** Instead of passing the scope through every service (points 1–3 below as
> first written), ONE guard in the database client (`lib/ownership/guard.ts`, wired in `lib/prisma.ts`) adds the business to every
> read, update and delete on an owned table and stamps it on every create, from a scope set once per request
> (`lib/ownership/scope.ts`: `runInScope`, and `runAsSystem(reason)` for named cross-business lookups, allowlisted in CI). It cannot
> be forgotten in one service, and the diff stays small. During Phase B no scope means Shaadi Shopping (today's behaviour); before
> any venue screen ships it becomes fail-closed. Proven by `tests-db/ownership.isolation.test.ts` (two businesses). Child records
> (tasks, guests, vendor bookings, lines…) are added to the guard in the next Phase B step.

1. **One place decides the scope.** Every request resolves a `BusinessScope` once — `{ businessId, role }` — from the login and
   the business it is working in. No route reads `businessId` from the request body or the URL.
2. **Services take the scope as their first argument** and every read and write of an owned table filters by it
   (`where: { businessId: scope.businessId, … }`); children are reached only through an owned parent. A record outside the scope
   answers exactly like a record that does not exist (404), never "forbidden" — no information about other businesses leaks.
3. **A test fails CI** if a query on an owned table appears without a scope (a source scan in `lib/ciConfig.test.ts`'s style),
   and a real-database test creates two businesses and checks that neither can read, change, count or link the other's records
   through any service.
4. **Later, a second lock:** Postgres row-level security on the owned tables, so even a code mistake cannot cross businesses.
   Not in the first phase — it needs the app to connect with a per-request business setting, which is a larger change.

## 5. Phases — each one shippable, each one tested end to end

| Phase | What changes | Visible to users? | Risk |
|---|---|---|---|
| **A. Foundation** | `Business`, `BusinessMember`, `businessId` on the owned tables; every existing row → Shaadi Shopping; existing logins → members | No | One migration with a backfill (backup → migrate → verify) |
| **B. Enforce for Shaadi Shopping** | All ~190 query sites take the scope; the CI scan and the two-business database test land | No — Shaadi Shopping staff see exactly what they see today | Largest code change; fully covered by the existing 1,341 unit + 128 database tests |
| **C. A venue's own enquiries (Flow A, first slice)** | In Vendor OS (the rebased `feat/vivah-os-design-components`): **+ New Enquiry** (name, phone, date, guests, need) → "Next: follow up" → follow-up tasks → the venue's **Your Enquiries** list | Yes, to venue logins | Small; reuses the CRM services with the venue's scope |
| **D. Quote → booking → wedding for the venue** | The existing quotation, proposal link, agreement, payment and wedding services, scoped to the venue; per-business numbering and payee | Yes | Medium |
| **E. Staff, plans, commercial status** | Add venue staff; commercial status (Commission / SaaS / Both / Marketplace only / Inactive) on the business; the SaaS plan attaches here (Roadmap Block 2) | Yes | Medium |

Phase A + B change nothing anyone can see; that is deliberate — the risky part (scoping every query) lands while the behaviour is
provably identical, and only then do venues get screens.

## 6. Decisions (all approved 4 Oct 2026, as recommended)

| # | Decision | Approved |
|---|---|---|
| **D1** | A **Business** that owns every record (Shaadi Shopping = business #1), not an owner column per table | **Business** |
| **D2** | Venues can have several logins (Owner / Staff) | **Yes** |
| **D3** | A venue's own customers are **private** from Shaadi Shopping staff (founder sees counts only; support access only when the venue switches it on, logged) | **Private** |
| **D4** | Same couple from both sides: link to the Shaadi Shopping enquiry *for that venue* and apply commission; nothing else is revealed either way | **Link + commission** |
| **D5** | Commission only on Shaadi Shopping–sourced bookings; never on a venue's own | **Yes** |
| **D6** | Quotation / invoice numbers per business, with a short prefix | **Per business** |
| **D7** | Money for a venue's booking goes to the venue's own UPI / payee | **Yes** |
| **D8** | A venue's own quotation link shows the venue's brand ("Powered by Vivah OS") | **Venue brand** |
| **D9** | Build order A → B → C → D → E, A and B invisible | **Yes** |

## 7. Not in this design

Billing and invoicing for SaaS plans (Roadmap Block 2), a venue inviting its own vendors (caterers it works with) as businesses,
moving customers between businesses, white-label domains, Postgres row-level security (phase-2 hardening, §4.7.4), and the
Customer Portal for venue-owned weddings (the link works for both from day one).

## 8. People, memberships and permissions (Phase 1 — built 7 Oct 2026)

Founder decision, 7 Oct 2026. §4.2 gave a business one login (its owner, through `VendorProfile`) and a STAFF role nobody could
be given. The model is now:

```
Person (User)  →  Business Membership  →  Role  →  Permissions
```

- **A person signs in as themselves:** their own mobile number + their own 6-digit code — founder, manager, employee or vendor
  owner, the same mechanism. The code is on the person (`users.loginCodeHash`), not on a vendor link. No shared passwords.
- **A membership** (`business_members`) says which business a person belongs to, with a role (`OWNER`, `MANAGER`, `EMPLOYEE`;
  `STAFF` is the older role, kept), a job title, and that person's own changes to the role's permissions (`grants`, `denies`).
  One person may hold several memberships. Shaadi Shopping's own team are members of the Shaadi Shopping business.
- **Workspace:** after signing in, a person with one membership goes straight in; with several they see **Choose Workspace**
  (`/workspace`). The choice is a cookie and only a preference — every request checks it against the person's memberships.

### 8.1 Permissions — one model, enforced on the server

`lib/auth/permissions.ts` is the only place permissions are defined:

| Permission | What it allows |
|---|---|
| `enquiries` | see and work the business's enquiries |
| `quotations` | make, send and revise quotations |
| `weddings` | manage booked weddings / events |
| `tasks` | give out work and manage the team's tasks |
| `catalog` | what the business offers and its price list |
| `view_financials` | see payments received, amounts due and totals |
| `edit_financials` | record payments and change payment details |
| `team` | add and remove people, set roles and permissions |
| `settings` | the business profile and settings |

| Role | Default permissions |
|---|---|
| Owner | everything, always — cannot be reduced |
| Manager | enquiries, quotations, weddings, tasks, catalog — **no money, no team, no settings** |
| Employee | none — their own assigned work only, until the owner gives more |
| Staff (older) | enquiries, quotations, weddings |

Effective permissions = the role's defaults + `grants` − `denies`. The owner can give one manager `view_financials` without
giving it to the others.

**Where it is enforced.** Not in the screens. Every Vendor OS route states what it needs —
`export const POST = venueScoped(handlePOST, 'quotations')` — and the wrapper (`lib/ownership/venueEntry.ts`) answers **403 before
the handler runs** for a member without it. `MEMBER` (said out loud) marks the few routes any member may use: their own login
code, and reading the business profile. A CI test (`lib/ownership/venuePermissions.test.ts`) fails when a Vendor OS route does
not say. Inside a service, `can(scope, …)` decides finer points: a manager sees a quotation but not what has been paid on it
(`moneyHidden`), nor the business's payment details.

### 8.2 Sign-in for Shaadi Shopping's own team

`/admin/login` is the same mobile + code screen. **Email and password is kept** at `/admin/login?with=password` until the code
sign-in is proven for founder, vendor owner, manager and employee (founder's decision). A team member registers **their own**
mobile number at Admin → More → **My sign-in** (`services/teamLogin.service.ts`): the number is typed on that screen, never in
source code; their password is asked again; the code is shown once. If the number already belongs to another login (the same
person's vendor login, say), they are told whose it is and must confirm — that person then gets the **same** access, never more,
and a fresh code.

### 8.3 What changed in the database (additive; nothing dropped)

- `20261007100000_add_member_roles` — `MANAGER`, `EMPLOYEE` added to `BusinessRole`.
- `20261007100100_person_code_and_memberships` — `users.loginCodeHash`, `loginCodeSetAt`; `business_members.jobTitle`, `grants`,
  `denies`, `removedAt`; each vendor owner's existing code copied to the person; Shaadi Shopping's team added as members of the
  Shaadi Shopping business (a SUPER_ADMIN as Owner; SALES / OPERATIONS as Managers who keep the access to money they have today).
- `vendor_profiles.loginCodeHash` / `loginCodeSetAt` stay, unread. `user_roles` (which portal a login may open) is unchanged.

### 8.4 What Phase 1 does not do yet

- **The Command Center's own routes** (about 70) still ask only "is this an internal team member?". The membership and its
  permissions exist for the team, but those routes are not yet behind `can()`.
- **Adding people:** there is no Team screen yet (Phase 2). The only way a second person gets a membership today is "My sign-in".
- **My Work** for an employee, and task assignment (Phase 2).
- **What Shaadi Shopping shares with a vendor** (availability requests, bookings, payouts — the older Vendor OS screens) is still
  read through the owner's vendor link, so a manager or employee sees none of it yet.
- The `/vendor` door still needs the `VENDOR` portal role; Phase 2's "Add employee" gives it.
