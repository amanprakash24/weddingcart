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
