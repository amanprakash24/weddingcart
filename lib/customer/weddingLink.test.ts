/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';

// The couple's login ↔ their wedding (MASTER-GAP-ANALYSIS §2.4.1). A fake database; nothing real is touched.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { coupleMobile, weddingCustomerFields } = await import('./weddingLink');

const fakeDb = (opts: { isCustomer?: boolean; userId?: string | null; updated?: number; fail?: boolean } = {}) => ({
  user: { findFirst: mock(async () => (opts.userId ? { id: opts.userId } : null)) },
  userRole: { findFirst: mock(async () => (opts.isCustomer === false ? null : { userId: 'u1' })) },
  wedding: { updateMany: mock(async () => { if (opts.fail) throw new Error('db down'); return { count: opts.updated ?? 1 }; }) },
});

describe('couple mobile', () => {
  test('normalised to the 10 digits logins use; anything else is not a mobile', () => {
    expect(coupleMobile('+91 98765 43210')).toBe('9876543210');
    expect(coupleMobile('09876543210')).toBe('9876543210');
    expect(coupleMobile('12345')).toBeNull();
    expect(coupleMobile(null)).toBeNull();
  });
});

describe('at wedding creation', () => {
  test('stores the mobile, and links an existing CUSTOMER login', async () => {
    const db = fakeDb({ userId: 'u-couple' });
    expect(await weddingCustomerFields(db as never, '98765 43210')).toEqual({ customerPhone: '9876543210', customer: { connect: { id: 'u-couple' } } });
    expect((db.user.findFirst.mock.calls[0] as unknown as [{ where: unknown }])[0].where).toEqual({ phone: '9876543210', roles: { some: { role: 'CUSTOMER' } } });
  });

  test('no valid mobile → nothing stored, nothing looked up', async () => {
    const db = fakeDb({ userId: 'u-couple' });
    expect(await weddingCustomerFields(db as never, 'not a phone')).toEqual({});
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });
});
