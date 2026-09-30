/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Every migration file must be pure SQL. On 30 Sep 2026 a generated migration picked up the env loader's console
// line ("◇ injected env … from .env.local") and Postgres rejected it on production at the first character — this
// catches that before a migration is ever applied.
const DIR = join(import.meta.dir, '..', 'prisma', 'migrations');
const migrations = readdirSync(DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => ({ name: d.name, sql: readFileSync(join(DIR, d.name, 'migration.sql'), 'utf8') }));

describe('migration files are pure SQL', () => {
  test('there are migrations to check', () => {
    expect(migrations.length).toBeGreaterThan(30);
  });

  test.each(migrations.map((m) => [m.name, m.sql]))('%s', (_name, sql) => {
    expect(sql.trim().length).toBeGreaterThan(0);
    expect(sql).not.toContain('injected env');
    expect(sql).not.toMatch(/[◇⌘]/);
    expect(sql).not.toMatch(/^\s*(Loaded Prisma config|Prisma schema loaded|Environment variables loaded)/m);
  });
});
