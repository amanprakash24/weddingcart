/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { OWNED_MODELS, PLATFORM_BUSINESS_ID } from './owned';

// Phase A of record ownership: the foundation is in place and changes nothing for anyone.
const root = join(import.meta.dir, '..', '..');
const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');
const block = (model: string) => {
  const start = schema.indexOf(`model ${model} {`);
  return schema.slice(start, schema.indexOf('\n}', start));
};

describe('record ownership — Phase A foundation', () => {
  test('every owned record carries its business, defaulting to Shaadi Shopping, indexed, and cannot lose it by a delete', () => {
    for (const model of OWNED_MODELS) {
      const b = block(model);
      expect(b).toContain(`businessId String   @default("${PLATFORM_BUSINESS_ID}")`);
      expect(b).toContain('business   Business @relation(fields: [businessId], references: [id], onDelete: Restrict)');
      expect(b).toContain('@@index([businessId])');
    }
  });

  test('a business has members with a role, and at most one public listing', () => {
    expect(block('BusinessMember')).toContain('@@unique([businessId, userId])');
    expect(block('Business')).toContain('vendorId         String?           @unique');
  });

  test('the migration creates the Shaadi Shopping business before any foreign key points at it', () => {
    const dir = join(root, 'prisma', 'migrations');
    const name = readdirSync(dir).find((d) => d.endsWith('_add_business_ownership'));
    expect(name).toBeTruthy();
    const sql = readFileSync(join(dir, name as string, 'migration.sql'), 'utf8');
    const insert = sql.indexOf(`VALUES ('${PLATFORM_BUSINESS_ID}', 'Shaadi Shopping', 'PLATFORM'`);
    expect(insert).toBeGreaterThan(0);
    expect(insert).toBeLessThan(sql.indexOf('FOREIGN KEY ("businessId")'));
    // Additive only: nothing is dropped or rewritten.
    expect(sql).not.toMatch(/DROP |UPDATE "|DELETE FROM/);
  });
});
