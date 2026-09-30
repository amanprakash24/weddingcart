/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Product rules from the Growth Partner brief, checked on the source so they can't quietly drift.
const root = join(import.meta.dir, '..', '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const page = read('components/growthPartner/GrowthPartnerPageClient.tsx');
const home = read('components/homepage/GrowthPartnerSection.tsx');

describe('Growth Partner — public page rules', () => {
  test('no fixed payout amount is promised anywhere public (payout depends on agreed terms)', () => {
    for (const text of [page, home]) expect(text).not.toMatch(/₹\s?\d/);
    expect(page).toContain('Referral payout is based on the referral category, business value and agreed terms');
  });

  test('never calls Shaadi Shopping a "marketplace" (brand voice)', () => {
    for (const text of [page, home]) expect(text.toLowerCase()).not.toContain('marketplace');
  });

  test('the homepage section only introduces the program and links to /growth-partner — no form there', () => {
    expect(home).toContain('href="/growth-partner"');
    expect(home).not.toMatch(/<form|<input/);
    expect(read('components/HomepageClient.tsx')).toMatch(/<FeaturedVendorsSection \/>\s*<GrowthPartnerSection \/>/);
  });

  test('both forms need consent; CTA clicks are tracked', () => {
    expect(page).toContain('I agree to be contacted by Shaadi Shopping regarding the Growth Partner Program');
    expect(page).toContain('I confirm this person / business agreed to be contacted by Shaadi Shopping.');
    for (const text of [page, home]) expect(text).toContain("trackEvent('growth_partner_cta_click'");
  });

  test('listed in the sitemap and the admin navigation', () => {
    expect(read('app/sitemap.ts')).toContain('${BASE_URL}/growth-partner`');
    expect(read('components/admin/adminNav.ts')).toContain("href: '/admin/growth-partners'");
  });
});
