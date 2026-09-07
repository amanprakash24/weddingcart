/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { buildPoolConfig } from './prismaPoolConfig';

// Pure function — no mocking needed, no DATABASE_URL/DB connection required.
// This is the actual production connection-pool-exhaustion fix: caps
// node-postgres's per-process Pool at max: 3 instead of its default of 10,
// which (combined with Vercel spinning up separate serverless instances for
// concurrent requests) was exceeding Supabase's transaction-mode pooler's
// own backend connection limit.
describe('buildPoolConfig', () => {
  test('caps the pool at max: 3', () => {
    const config = buildPoolConfig('postgresql://user:pass@localhost:6543/testdb');
    expect(config.max).toBe(3);
  });

  test('passes the connection string through unchanged', () => {
    const config = buildPoolConfig('postgresql://user:pass@localhost:6543/testdb');
    expect(config.connectionString).toBe('postgresql://user:pass@localhost:6543/testdb');
  });
});
