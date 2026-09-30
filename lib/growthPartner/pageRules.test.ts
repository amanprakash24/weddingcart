/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Product rules from the Growth Partner brief, checked on the source so they can't quietly drift.
const root = join(import.meta.dir, '..', '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const page = read('components/growthPartner/GrowthPartnerPageClient.tsx');
const home = read('components/homepage/GrowthPartnerSection.tsx');
const forms = read('components/growthPartner/GrowthPartnerForms.tsx');

describe('Growth Partner — public page rules', () => {
  test('no fixed payout amount is promised anywhere public (payout depends on agreed terms)', () => {
    for (const text of [page, home, forms]) expect(text).not.toMatch(/₹\s?\d/);
    expect(page).toContain('Referral payout is based on the referral category, business value and agreed terms');
  });

  test('never calls Shaadi Shopping a "marketplace" (brand voice)', () => {
    for (const text of [page, home, forms]) expect(text.toLowerCase()).not.toContain('marketplace');
  });

  test('the homepage section only introduces the program and links to /growth-partner — no form there', () => {
    expect(home).toContain('href="/growth-partner"');
    expect(home).not.toMatch(/<form|<input/);
    expect(read('components/HomepageClient.tsx')).toMatch(/<FeaturedVendorsSection \/>\s*<GrowthPartnerSection \/>/);
  });

  test('both forms need consent; CTA clicks are tracked', () => {
    expect(forms).toContain('I agree to be contacted by Shaadi Shopping regarding the Growth Partner Program');
    expect(forms).toContain('I confirm this person / business agreed to be contacted by Shaadi Shopping.');
    for (const text of [page, home]) expect(text).toContain("trackEvent('growth_partner_cta_click'");
  });

  test('listed in the sitemap and the admin navigation', () => {
    expect(read('app/sitemap.ts')).toContain('${BASE_URL}/growth-partner`');
    expect(read('components/admin/adminNav.ts')).toContain("href: '/admin/growth-partners'");
  });

  test('no couples-only interruptions on the sign-up page; the navbar opens transparent over the photo hero', () => {
    expect(read('components/LeadCapturePopup.tsx')).toContain("pathname.startsWith('/growth-partner')");
    expect(read('components/ContactBanner.tsx')).toContain("pathname.startsWith('/growth-partner')");
    expect(read('components/Navbar.tsx')).toContain("pathname === '/growth-partner'");
  });

  test('uses our own photography only (files that exist in /public)', () => {
    const srcs = [...page.matchAll(/(?:src|img)[=:] ?["']?(\/[^"']+\.(?:jpg|jpeg|png|webp))["']/g), ...home.matchAll(/src="(\/[^"]+\.(?:jpg|jpeg|png|webp))"/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThan(4);
    for (const src of srcs) expect(existsSync(join(root, 'public', src))).toBe(true);
  });
});
