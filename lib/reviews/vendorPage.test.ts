/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Roadmap 1.4 decision (03/10/2026): couples' verified reviews are kept apart from the hand-entered online rating and never blended.
// Checked on the vendor page source so the rule can't quietly drift.
const src = readFileSync(join(import.meta.dir, '..', '..', 'components', 'VendorDetailClient.tsx'), 'utf8');

describe('vendor page — online rating vs couple reviews', () => {
  test('the hand-entered rating is labelled and only shown when it has a count (no default 4.5 with 0 reviews)', () => {
    expect(src).toContain('ONLINE_RATING_LABEL');
    expect(src).not.toMatch(/\(\{vendor\.reviewCount\} reviews\)/);
    for (const m of src.matchAll(/\{vendor\.rating\}/g)) {
      const before = src.slice(Math.max(0, (m.index ?? 0) - 400), m.index);
      expect(before).toContain('vendor.reviewCount > 0');
    }
  });

  test('couple reviews have their own section and numbers — never added to vendor.rating / reviewCount', () => {
    expect(src).toContain('VERIFIED_REVIEWS_LABEL');
    expect(src).not.toMatch(/vendor\.reviewCount\s*\+|\+\s*vendor\.reviewCount|verified[^;\n]*vendor\.rating|vendor\.rating[^;\n]*verified/);
  });
});
