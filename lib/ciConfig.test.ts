/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// CI (Roadmap step 2). Pins what the workflow must run, and that the lint exception for known debt can only shrink.
const root = join(import.meta.dir, '..');
const workflow = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
const eslint = readFileSync(join(root, 'eslint.config.mjs'), 'utf8');

// The 10 files that already broke react-hooks/set-state-in-effect when CI started (3 Oct 2026).
const FROZEN_DEBT = [
  'components/AdminBlogClient.tsx',
  'components/AdminCategoryDetailClient.tsx',
  'components/AdminClient.tsx',
  'components/AdminVendorFormClient.tsx',
  'components/AdminVendorListClient.tsx',
  'components/AdminVendorProspectsClient.tsx',
  'components/CategoryPageClient.tsx',
  'components/PlanPageClient.tsx',
  'components/admin/EventAdminClient.tsx',
  'components/homepage/FeaturedVendorsSection.tsx',
];

describe('CI workflow', () => {
  test('runs on every pull request and on main', () => {
    expect(workflow).toMatch(/on:\s*\n\s+pull_request:/);
    expect(workflow).toMatch(/push:\s*\n\s+branches: \[main\]/);
  });

  test('runs the type check, lint, unit tests, every migration and the database tests', () => {
    for (const step of ['bun install --frozen-lockfile', 'bunx tsc --noEmit', 'bun run lint', 'bun test', 'bunx prisma migrate deploy', 'bun run test:db']) {
      expect(workflow).toContain(step);
    }
  });

  test('uses no secrets, and the database tests only ever see the throwaway CI database', () => {
    expect(workflow).not.toContain('secrets.');
    expect(workflow).toContain('TEST_DATABASE_ALLOWED_REFS: localhost:5432/vivah_ci');
    expect(workflow).not.toMatch(/xlrswg|axuvgc|supabase/i);
  });
});

describe('lint debt', () => {
  test('the set-state-in-effect exception covers only files that had it when CI started — it can shrink, never grow', () => {
    const block = eslint.slice(eslint.indexOf('Known debt'), eslint.indexOf('"react-hooks/set-state-in-effect": "warn"'));
    const files = [...block.matchAll(/"(components\/[^"]+)"/g)].map((m) => m[1]);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(FROZEN_DEBT).toContain(f);
  });
});
