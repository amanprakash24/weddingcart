/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { NotFoundError } from '@/lib/errors';
import { makeListForSource, makeStaffAnswer, makeVendorAnswer } from './handlers';

// Fakes only: the session check and the service are passed in, so no shared module is replaced.
let session: { user: { id: string; roles: string[] } } | null;
const requireAdmin = mock(async () => (session && session.user.roles.some((r) => ['SUPER_ADMIN', 'SALES', 'OPERATIONS'].includes(r)) ? session : null));
const requireVendor = mock(async () => (session && session.user.roles.includes('VENDOR') ? session : null));
const listForSource = mock(async () => ({ enquiries: [], alerts: [] }));
const answerAsStaff = mock(async () => 'AVAILABLE');
const answerAsVendor = mock(async (_userId: string, id: string) => {
  if (id !== 'e-own') throw new NotFoundError('Vendor enquiry', 'unavailable');
  return { id, status: 'AVAILABLE' };
});
const staff = { requireAdmin, listForSource, answerAsStaff };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown) => new NextRequest('https://www.shaadishopping.com/api/x', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => {
  session = null;
  for (const m of [requireAdmin, requireVendor, listForSource, answerAsStaff, answerAsVendor]) m.mockClear();
});

describe('staff routes', () => {
  test('logged out, a vendor or a customer → 401, nothing read or written', async () => {
    for (const roles of [null, ['VENDOR'], ['CUSTOMER']]) {
      session = roles ? { user: { id: 'u', roles } } : null;
      expect((await makeListForSource(staff)(new NextRequest('https://x/api?sourceType=CONSULTATION&sourceId=c1'))).status).toBe(401);
      expect((await makeStaffAnswer(staff)(post({ status: 'AVAILABLE', channel: 'PHONE' }), ctx('e1'))).status).toBe(401);
    }
    expect(listForSource).not.toHaveBeenCalled();
    expect(answerAsStaff).not.toHaveBeenCalled();
  });

  test('list needs a valid customer record', async () => {
    session = { user: { id: 'staff-1', roles: ['SALES'] } };
    expect((await makeListForSource(staff)(new NextRequest('https://x/api?sourceType=NOPE&sourceId=c1'))).status).toBe(400);
    const ok = await makeListForSource(staff)(new NextRequest('https://x/api?sourceType=CONSULTATION&sourceId=c1'));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    expect(listForSource).toHaveBeenCalledWith('CONSULTATION', 'c1');
  });

  test('recording an answer needs a known channel; the actor comes from the session', async () => {
    session = { user: { id: 'staff-1', roles: ['OPERATIONS'] } };
    expect((await makeStaffAnswer(staff)(post({ status: 'AVAILABLE', channel: 'CARRIER_PIGEON' }), ctx('e1'))).status).toBe(400);
    expect((await makeStaffAnswer(staff)(post({ status: 'MAYBE', channel: 'PHONE' }), ctx('e1'))).status).toBe(400);
    const res = await makeStaffAnswer(staff)(post({ status: 'AVAILABLE', channel: 'WHATSAPP', note: 'ok' }), ctx('e1'));
    expect(res.status).toBe(200);
    expect(answerAsStaff).toHaveBeenCalledWith('e1', { status: 'AVAILABLE', note: 'ok' }, 'WHATSAPP', 'staff-1');
  });
});

describe('vendor route', () => {
  test('only a logged-in vendor may answer — admins and customers cannot use it', async () => {
    for (const roles of [null, ['SUPER_ADMIN'], ['CUSTOMER']]) {
      session = roles ? { user: { id: 'u', roles } } : null;
      expect((await makeVendorAnswer({ requireVendor, answerAsVendor })(post({ status: 'AVAILABLE' }), ctx('e-own'))).status).toBe(401);
    }
    expect(answerAsVendor).not.toHaveBeenCalled();
  });

  test('the vendor is the session user — never an id from the request body', async () => {
    session = { user: { id: 'user-A', roles: ['VENDOR'] } };
    const res = await makeVendorAnswer({ requireVendor, answerAsVendor })(post({ status: 'AVAILABLE', vendorId: 'someone-else', userId: 'x' }), ctx('e-own'));
    expect(res.status).toBe(200);
    expect(answerAsVendor).toHaveBeenCalledWith('user-A', 'e-own', { status: 'AVAILABLE' });
  });

  test("another vendor's enquiry → 404", async () => {
    session = { user: { id: 'user-A', roles: ['VENDOR'] } };
    expect((await makeVendorAnswer({ requireVendor, answerAsVendor })(post({ status: 'AVAILABLE' }), ctx('e-other'))).status).toBe(404);
  });
});
