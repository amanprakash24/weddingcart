# 14 — Growth Partner Program (V1)

**Connect. Refer. Earn.** People with wedding-industry contacts register as Growth Partners and refer venues,
vendors, clients or events. Shaadi Shopping handles the business; a successfully completed referral earns an agreed
payout. Built 30 Sep 2026 from the *Growth Partner Program — Tech & Design Brief*.

V1 answers four questions only — **who is the partner, what did they refer, did it convert, what payout is due** —
and is run by hand: staff verify every partner and referral and enter any payout themselves. It is deliberately not an
affiliate platform.

## Pages
- **`/growth-partner`** (public, indexable, in the sitemap): hero → who can join → what you can refer (4 cards) → how
  it works (Connect → Refer → Business → Complete → Earn) → why → how payment works → registration + referral forms →
  FAQ → final CTA. Mobile-first, maroon + gold + ivory, icon illustrations (no stock photos). **No fixed payout amounts**
  anywhere ("based on the referral category, business value and agreed terms; paid after successful completion").
- **Homepage section** (`components/homepage/GrowthPartnerSection.tsx`), between *Featured vendors* and the blog:
  introduces the program and links to `/growth-partner` — no form on the homepage.
- **`/admin/growth-partners`** (staff, *More → Growth partners*): headline numbers (partners, active, new referrals,
  converted, completed, payouts due ₹, total paid ₹), a Referrals tab (status, assignee, payout status/amount, notes)
  and a Partners tab (status).

## Rules
- **Registration** needs name, 10-digit Indian mobile, city, "what best describes you", at least one referral type and
  consent. A new partner gets a **Partner code** (`GP-1001`, `GP-1002` …; issued under a lock). An already-registered
  mobile gets "you're already registered" **without** the code, so nobody can look up someone else's code.
- **Referrals** are submitted with the partner's **registered mobile + Partner code** (one message for every
  mismatch) and require the partner's confirmation that the referred person/business **agreed to be contacted**.
  Rejected/inactive partners cannot submit.
- **Rate limits** (existing `login_attempts` limiter): registration 5 / 15 min per IP; referrals 10 / 15 min per IP —
  wrong codes count too, so codes can't be guessed.
- **Payout:** only after the referral is **Completed**; "Paid" needs an amount; the referral status and payout status
  move together (Paid ⇔ Paid). Amounts are always entered by staff — no automatic rates.
- **Tracking** (GA4 events): `growth_partner_cta_click` (location: homepage / hero / final), `growth_partner_registered`,
  `growth_partner_referral_submitted`.

## Data (migration `20260930150000_add_growth_partner`, additive)
`GrowthPartner` (code, name, phone unique, whatsapp, email, city, category, referralTypes, networkNote, consentAt,
status, staffNotes) and `PartnerReferral` (partner, type, name, phone, city, requirement, notes, consentAt, status,
assignedTo, completedAt, payoutStatus, payoutAmount, paidAt, staffNotes). Statuses — partner: New · Under review ·
Approved · Rejected · Inactive; referral: Submitted → Verified → Contacted → In discussion → Converted → Completed →
Paid (or Rejected); payout: Not due · Due · Paid.

## Not in V1 (brief's V2)
Partner login/dashboard, referral links/codes, leaderboard, automated payout calculation, WhatsApp notifications,
analytics, AI qualification, and turning referrals into CRM leads / vendor prospects automatically.
