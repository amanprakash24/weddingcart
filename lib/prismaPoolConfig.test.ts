/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { buildPoolConfig, TRANSACTION_OPTIONS } from './prismaPoolConfig';

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

// Live trace (21 Sep 2026): Revise's steps completed at 0.6 s, 2.6 s, 4.7 s and 5.6 s, so the default 5 s transaction timeout
// expired mid-way. The defaults must comfortably exceed that, without being unbounded.
describe('TRANSACTION_OPTIONS', () => {
  test('allow far longer than the 5 s default, so a slow round-trip link cannot expire a transaction mid-way', () => {
    expect(TRANSACTION_OPTIONS.timeout).toBeGreaterThanOrEqual(20_000);
    expect(TRANSACTION_OPTIONS.maxWait).toBeGreaterThanOrEqual(5_000);
  });

  test('stay bounded, so a genuinely stuck transaction still ends', () => {
    expect(TRANSACTION_OPTIONS.timeout).toBeLessThanOrEqual(60_000);
  });
});
