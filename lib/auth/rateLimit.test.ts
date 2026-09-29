/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';

// Mocks `@/lib/prisma` wholesale (no DATABASE_URL/DB connection needed, same
// technique used elsewhere in this repo — e.g. services/booking.service.test.ts)
// with a real in-memory LoginAttempt store, so `count`/`create` actually apply
// the same identifier+createdAt-window filtering the real query does — a
// passing test here is evidence the windowing/threshold logic is correct, not
// just that the mock was called.
interface StoredAttempt {
  identifier: string;
  success: boolean;
  createdAt: Date;
}

function makeLoginAttemptStore() {
  const rows: StoredAttempt[] = [];
  return {
    rows,
    count: mock(async (args: { where: { identifier: string; success?: boolean; createdAt: { gt: Date } } }) => {
      const { identifier, success, createdAt } = args.where;
      return rows.filter(
        (r) =>
          r.identifier === identifier &&
          r.createdAt.getTime() > createdAt.gt.getTime() &&
          (success === undefined || r.success === success)
      ).length;
    }),
    create: mock(async (args: { data: { identifier: string; success: boolean } }) => {
      const row = { ...args.data, createdAt: new Date() };
      rows.push(row);
      return row;
    }),
    deleteMany: mock(async (args: { where: { createdAt: { lt: Date } } }) => {
      const keep = rows.filter((r) => r.createdAt.getTime() >= args.where.createdAt.lt.getTime());
      const count = rows.length - keep.length;
      rows.splice(0, rows.length, ...keep);
      return { count };
    }),
  };
}

async function loadRateLimitWith(store: ReturnType<typeof makeLoginAttemptStore>) {
  mock.module('@/lib/prisma', () => ({ prisma: { loginAttempt: store } }));
  return import('./rateLimit');
}

describe('isRequestRateLimited / recordRequest — general request-volume throttle', () => {
  test('allows requests under the threshold, then blocks once the threshold is reached', async () => {
    const store = makeLoginAttemptStore();
    const { isRequestRateLimited, recordRequest } = await loadRateLimitWith(store);

    for (let i = 0; i < 5; i++) {
      expect(await isRequestRateLimited('consultation:1.2.3.4')).toBe(false);
      await recordRequest('consultation:1.2.3.4');
    }
    // 5 requests recorded — the 6th check must now be blocked.
    expect(await isRequestRateLimited('consultation:1.2.3.4')).toBe(true);
  });

  test('a caller-supplied max raises the budget without changing the default for others', async () => {
    const store = makeLoginAttemptStore();
    const { isRequestRateLimited, recordRequest } = await loadRateLimitWith(store);

    for (let i = 0; i < 5; i++) await recordRequest('onboarding-upload:1.2.3.4');
    // Default (5) is exhausted, but a 20-per-window caller still has room...
    expect(await isRequestRateLimited('onboarding-upload:1.2.3.4')).toBe(true);
    expect(await isRequestRateLimited('onboarding-upload:1.2.3.4', { max: 20 })).toBe(false);
    // ...and is blocked exactly at its own limit.
    for (let i = 0; i < 15; i++) await recordRequest('onboarding-upload:1.2.3.4');
    expect(await isRequestRateLimited('onboarding-upload:1.2.3.4', { max: 20 })).toBe(true);
  });

  test('a caller-supplied window is honoured', async () => {
    const store = makeLoginAttemptStore();
    const { isRequestRateLimited, recordRequest } = await loadRateLimitWith(store);

    for (let i = 0; i < 5; i++) await recordRequest('x:1');
    // Default 15-minute window sees them; a zero-length window sees none.
    expect(await isRequestRateLimited('x:1')).toBe(true);
    expect(await isRequestRateLimited('x:1', { windowMinutes: 0 })).toBe(false);
  });

  test('does not let one identifier affect another', async () => {
    const store = makeLoginAttemptStore();
    const { isRequestRateLimited, recordRequest } = await loadRateLimitWith(store);

    for (let i = 0; i < 5; i++) {
      await recordRequest('consultation:1.2.3.4');
    }
    expect(await isRequestRateLimited('consultation:1.2.3.4')).toBe(true);
    expect(await isRequestRateLimited('consultation:5.6.7.8')).toBe(false);
  });

  test('does not count requests outside the window', async () => {
    const store = makeLoginAttemptStore();
    const { isRequestRateLimited } = await loadRateLimitWith(store);

    // Directly seed 5 rows older than the 15-minute window.
    const old = new Date(Date.now() - 20 * 60 * 1000);
    for (let i = 0; i < 5; i++) {
      store.rows.push({ identifier: 'consultation:1.2.3.4', success: true, createdAt: old });
    }
    expect(await isRequestRateLimited('consultation:1.2.3.4')).toBe(false);
  });

  test('recordRequest always records success: true, regardless of downstream outcome', async () => {
    const store = makeLoginAttemptStore();
    const { recordRequest } = await loadRateLimitWith(store);

    await recordRequest('consultation:1.2.3.4');
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toMatchObject({ identifier: 'consultation:1.2.3.4', success: true });
  });
});

describe('retention — rows older than 30 days are tidied up as the table is used', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = new Date('2026-09-30T12:00:00Z');
  const seed = (store: ReturnType<typeof makeLoginAttemptStore>) => {
    store.rows.push(
      { identifier: 'admin@example.com', success: false, createdAt: new Date(NOW.getTime() - 45 * DAY) }, // old → removed
      { identifier: 'consultation:1.2.3.4', success: true, createdAt: new Date(NOW.getTime() - 31 * DAY) }, // old → removed
      { identifier: 'otp-send:1.2.3.4', success: true, createdAt: new Date(NOW.getTime() - 29 * DAY) }, // kept
      { identifier: 'proposal-miss:1.2.3.4', success: true, createdAt: new Date(NOW.getTime() - 5 * 60 * 1000) } // in a live window → kept
    );
  };

  test('pruneOldAttempts deletes only rows older than 30 days — never anything a limiter can still read', async () => {
    const store = makeLoginAttemptStore();
    const { pruneOldAttempts, RETENTION_DAYS } = await loadRateLimitWith(store);
    seed(store);
    expect(RETENTION_DAYS).toBe(30);
    expect(await pruneOldAttempts(NOW)).toBe(2);
    expect(store.rows.map((r) => r.identifier)).toEqual(['otp-send:1.2.3.4', 'proposal-miss:1.2.3.4']);
    const cutoff = (store.deleteMany.mock.calls.at(-1) as unknown as [{ where: { createdAt: { lt: Date } } }])[0].where.createdAt.lt;
    expect(cutoff.toISOString()).toBe(new Date(NOW.getTime() - 30 * DAY).toISOString());
  });

  test('it runs about one write in fifty: exactly when the dice say so', async () => {
    const store = makeLoginAttemptStore();
    const { maybePruneOldAttempts, PRUNE_CHANCE } = await loadRateLimitWith(store);
    seed(store);
    expect(PRUNE_CHANCE).toBe(1 / 50);
    expect(await maybePruneOldAttempts(() => 0.5, NOW)).toBe(false);
    expect(store.rows).toHaveLength(4);
    expect(await maybePruneOldAttempts(() => 0.001, NOW)).toBe(true);
    expect(store.rows).toHaveLength(2);
  });

  test('a failing tidy-up never throws — the request that triggered it is unaffected', async () => {
    const store = makeLoginAttemptStore();
    store.deleteMany.mockImplementation(async () => {
      throw new Error('db down');
    });
    const { pruneOldAttempts, maybePruneOldAttempts } = await loadRateLimitWith(store);
    expect(await pruneOldAttempts(NOW)).toBe(0);
    expect(await maybePruneOldAttempts(() => 0, NOW)).toBe(true);
  });

  test('recordRequest and recordLoginAttempt still write their row even when the tidy-up fails', async () => {
    const store = makeLoginAttemptStore();
    store.deleteMany.mockImplementation(async () => {
      throw new Error('db down');
    });
    const { recordRequest, recordLoginAttempt } = await loadRateLimitWith(store);
    const realRandom = Math.random;
    Math.random = () => 0; // force the tidy-up to run on these writes
    try {
      await recordRequest('consultation:9.9.9.9');
      await recordLoginAttempt('admin@example.com', false);
    } finally {
      Math.random = realRandom;
    }
    expect(store.rows.map((r) => r.identifier)).toEqual(['consultation:9.9.9.9', 'admin@example.com']);
    expect(store.deleteMany).toHaveBeenCalledTimes(2);
  });
});
