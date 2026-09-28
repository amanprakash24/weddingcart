/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';

// In-memory users table: id -> sessionVersion.
const users = new Map<string, number>();
mock.module('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mock(async ({ where }: { where: { id: string } }) =>
        users.has(where.id) ? { sessionVersion: users.get(where.id)! } : null
      ),
      updateMany: mock(async ({ where }: { where: { id: string } }) => {
        if (!users.has(where.id)) return { count: 0 };
        users.set(where.id, users.get(where.id)! + 1);
        return { count: 1 };
      }),
    },
  },
}));

const { isSessionCurrent, endAllSessions } = await import('./sessionVersion');

beforeEach(() => {
  users.clear();
  users.set('admin-1', 0);
  users.set('admin-2', 3);
});

describe('isSessionCurrent', () => {
  test('valid: user exists and the token version matches', async () => {
    expect(await isSessionCurrent('admin-1', 0)).toBe(true);
    expect(await isSessionCurrent('admin-2', 3)).toBe(true);
  });

  test('invalid: the user no longer exists (e.g. a token from the deleted database)', async () => {
    expect(await isSessionCurrent('ghost-user', 0)).toBe(false);
  });

  test('invalid: token version is older than the user\'s (logged out elsewhere)', async () => {
    expect(await isSessionCurrent('admin-2', 2)).toBe(false);
  });

  test('invalid: token issued before versions existed (no version) or with no user id', async () => {
    expect(await isSessionCurrent('admin-1', undefined)).toBe(false);
    expect(await isSessionCurrent('admin-1', null)).toBe(false);
    expect(await isSessionCurrent(undefined, 0)).toBe(false);
  });
});

describe('endAllSessions', () => {
  test('ends every existing token of that user — and only that user', async () => {
    const tokenOnLaptop = 0;
    const tokenOnPhone = 0;
    await endAllSessions('admin-1');
    expect(await isSessionCurrent('admin-1', tokenOnLaptop)).toBe(false);
    expect(await isSessionCurrent('admin-1', tokenOnPhone)).toBe(false);
    expect(await isSessionCurrent('admin-2', 3)).toBe(true);
  });

  test('a fresh login after logout (new version) is valid again', async () => {
    await endAllSessions('admin-1');
    expect(await isSessionCurrent('admin-1', 1)).toBe(true);
  });

  test('a missing user is a no-op, not an error', async () => {
    await expect(endAllSessions('ghost-user')).resolves.toBeUndefined();
  });
});
