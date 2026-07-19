# SEO Audit — 2026-07-19

Grounded in the actual codebase (file:line citations throughout), not generic SEO
advice. A prior audit cycle already landed (`PR #23/#24 "fix/seo-code-audit"`,
commits `3e645c1`/`8b2196d`) — this audit checks current state, not that diff, so
some items below may already be improvements on what existed before that PR.

Prioritized by estimated ranking/indexing impact, not effort.

---

## P0 — Structural issues actively working against rankings

### 1. Every vendor has 2–3 competing indexable URLs

`/vendors/[id]` and `/portfolio/[id]` are separate, both-indexed, both-sitemapped
routes for the **same vendor** (`app/sitemap.ts:96-108`, priorities 0.7 vs 0.6).
Their titles/descriptions are template variants of the same facts (name, category,
city) — classic thin duplicate content. Worse, the portfolio page's own JSON-LD
`@id`/`url` field points at the *other* URL (`/vendors/${id}`,
`app/portfolio/[id]/page.tsx:79-90`) while its `<link rel="canonical">` self-references
— an internal contradiction about which URL is canonical.

For at least 3 vendors (Touch of Cozy, Swayamvar Hall, 7 Vachan) there's a **third**
URL: a hand-built `/lp/*` landing page, also indexed, also sitemapped, also
representing the same venue.

**Recommendation:** pick one canonical URL per vendor (`/vendors/[id]` is the
stronger candidate — DB-driven, most complete schema) and:
- Add `<link rel="canonical">` on `/portfolio/[id]` pointing at `/vendors/[id]`
  (not self), and fix the JSON-LD `@id`/`url` to match.
- Remove `/portfolio/[id]` entries from `app/sitemap.ts` (keep the route working —
  don't 404 existing backlinks/bookmarks — just stop actively promoting it).
- For the 3 `/lp/*` venues specifically: decide whether the landing page or the DB
  vendor page should win, then canonical the loser to the winner. **This needs a
  product call, not a unilateral fix** — the `/lp/*` pages have more invested
  content/schema in some cases.

### 2. Keyword cannibalization: two blog posts target the same query

- `best-banquet-halls-patna-wedding-marriage-hall` (`data/blogSeedData.ts:2429`,
  linked from the homepage `CitiesSection`)
- `best-banquet-hall-in-patna` (added via `scripts/add-blog-banquet-hall-patna.mjs:22`,
  pinned in the sitemap at priority 0.92, one of only 3 hand-pinned posts)

Same primary keyword ("best banquet hall(s) Patna"), same year, same intent, two
articles. Google will pick one to rank and likely suppress the other, wasting the
priority-0.92 sitemap pin.

**Recommendation:** merge into one authoritative post (301 the weaker slug to the
stronger one) or clearly differentiate their target keywords/intent if both are
meant to stay.

### 3. Mislabeled navigation links send users and link equity to the wrong page

`components/Navbar.tsx:76` — the **"Accommodation"** menu item links to
`/categories/venue`, not `/categories/accommodation`.
`components/Navbar.tsx:104` — **"Pandits & Astrologers"** links to
`/categories/planning`, not `/categories/astro`.

Both target pages (`/categories/accommodation`, `/categories/astro`) are real,
indexed, sitemap-listed routes that consequently get **zero internal links** from
primary navigation.

**Recommendation:** straightforward `href` fix — no product decision required, happy
to apply this directly if you want.

### 4. Three category pages have no internal links anywhere on the site

`/categories/accommodation`, `/categories/legal`, `/categories/hospitality` — all
real, indexed, sitemap-listed — were not found linked from Navbar, Footer, or
homepage in the components searched. Orphaned pages are slow to get (re)crawled and
accrue no internal link equity.

**Recommendation:** add them to the relevant Navbar section(s) (accommodation
naturally fits "Venue & Stay," legal/hospitality could join "Planning &
Coordination").

### 5. 132 indexed Bihar-expansion-city pages are unlinked from all navigation

The 12 Bihar expansion cities (Muzaffarpur, Gaya, Bhagalpur, Darbhanga, Purnia,
Arrah, Begusarai, Chhapra, Hajipur, Bihar Sharif, Motihari, Samastipur —
`data/biharCities.ts`) × city + city-category pages are indexed and sitemapped with
genuinely unique per-city content, but **not linked from Navbar, Footer, or the
homepage `CitiesSection`** (`components/homepage/CitiesSection.tsx:22-32` only lists
the same 9 non-Bihar metros). Meanwhile the Footer's "Cities We Serve" block
(`components/Footer.tsx:31-40`) prominently links to those same 9 non-Bihar cities —
**which are `noindex` and excluded from the sitemap** (`app/cities/[city]/page.tsx:168`).
The footer is spending link real estate on non-indexable pages while the 132 pages
you actually want ranked get no on-site links at all.

**Recommendation:** swap the Footer/homepage city links from the 9 non-Bihar metros
to the 12 indexed Bihar cities (or add both, with the Bihar cities first/prioritized).
This is likely the single highest-leverage fix in this audit — it's real content
already built and indexed, just invisible to both users and crawlers navigating the
site normally.

---

## P1 — Real gaps, lower blast radius

### 6. No related/similar vendors on vendor detail pages
`components/VendorDetailClient.tsx` has breadcrumbs and city/category footer links,
but no "similar vendors" or "you might also like" module. Link equity flows
one-directionally from listing pages down to vendors, never laterally between
vendors — a missed internal-linking opportunity at real scale (93 vendors today).

### 7. Reverted LCP image optimization — verify live, don't assume fixed
`git log`: an image-compression fix for LCP (`a3620fd`) was merged then reverted
(`63d8e19`), and no replacement fix is visible in recent history. Core Web Vitals
(LCP specifically) is a ranking factor — worth measuring live (e.g. PageSpeed
Insights on the homepage and a vendor page) rather than assuming this was
re-addressed elsewhere.

### 8. Dead category-page metadata for 9 redirecting slugs
`app/categories/[slug]/page.tsx:246-251` — 9 category slugs (venue, makeup, mehndi,
decorator, band, dj, catering, photo-video, planning) immediately
`permanentRedirect()` to `/cities/patna/[slug]`, but `generateMetadata` still
computes a full title/description/OG object for them first — dead code, not
user/crawler-visible harm (redirects are followed correctly), but worth cleaning up.

### 9. Bihar city-category pages are template-thin at scale
108 pages (12 Bihar cities × 9 categories, `app/cities/[city]/[category]/page.tsx:176-177`)
share a structurally identical title/description pattern, differing only by city name
substitution (Patna itself gets genuinely unique hand-curated copy via
`PATNA_CATEGORY_SEO`, the other 12 cities don't). Not duplicate content exactly
(`editorialText()` does inject some per-city copy), but thin at this scale — worth
monitoring for thin-content flags as the site grows, and a candidate for the same
hand-curation treatment Patna got, prioritized by traffic.

### 10. Vendor structured data is generic outside the venue category
Only `category === 'venue'` gets `EventVenue` schema
(`app/vendors/[id]/page.tsx:160-219`); every other category (makeup, photography,
catering, etc.) gets plain `LocalBusiness`. More specific schema types exist and
could unlock richer snippets for those categories.

### 11. Blog `FAQPage` schema is hardcoded to one post
`app/blog/[slug]/page.tsx:146-183` — FAQ schema is gated to exactly the
`court-marriage-registration-patna-bihar` slug, not derived from actual FAQ-shaped
content in other posts. Arbitrary, and likely under-using a schema type that helps
other posts too.

---

## P2 — Minor / trust signal

### 12. Dead footer links
`components/Footer.tsx:48-49` — "Privacy Policy" and "Terms of Service" both
`href="#"`. Not a ranking factor directly, but a real trust-signal/E-E-A-T gap for a
site handling bookings and phone numbers.

---

## What's already strong (no action needed)

- **Image alt text** — consistently descriptive and dynamic across `VendorCard`,
  `VendorDetailClient`, `CategoryPageClient`, `BlogListClient`, homepage sections.
  The 2 empty-`alt` instances found are correctly decorative images, not gaps.
- **Vendor detail, homepage, and blog post metadata** — dynamic, unique, canonical
  tags present, full OG/Twitter coverage.
- **Structured data breadth** — `LocalBusiness`, `BreadcrumbList`, `FAQPage`,
  `CollectionPage`, `ItemList`, `BlogPosting` all in active use across most page
  types via a shared `JsonLd` component.
- **Patna city-category pages** — genuinely unique, hand-curated titles/descriptions/
  FAQs (`PATNA_CATEGORY_SEO`), and strong sibling cross-linking to other categories
  in the same city.
- **Blog internal linking** — breadcrumbs, "back to all posts," and a real
  related-posts-by-category module.
- **robots.ts / sitemap.ts fundamentals** — correct disallow rules, correct
  noindex-and-excluded handling for non-Bihar cities, `/lp/*` and
  `/venues-in-patna` correctly crawlable (fixed in a prior audit cycle).

---

## Suggested order of attack

1. Fix the two mislabeled nav links (#3) — trivial, zero risk, immediate.
2. Swap Footer/homepage city links to the 12 indexed Bihar cities (#5) — highest
   leverage relative to effort, no product ambiguity.
3. Add nav links for the 3 orphaned categories (#4) — trivial.
4. Decide the vendor canonical-URL strategy (#1) — needs your call on `/lp/*` vs DB
   pages for the 3 overlapping venues, then it's a mechanical fix.
5. Resolve the banquet-hall blog duplication (#2) — needs a look at both posts to
   decide merge vs. differentiate.
6. Everything else (P1/P2) as time allows — none of it is actively harming rankings
   the way #1–#5 plausibly are.

Want me to implement any of these now? #3 and the nav-link fixes in particular are
safe, mechanical changes I could make on this branch immediately.
