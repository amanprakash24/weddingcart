/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { ValidationError } from '@/lib/errors';
import { makeListPartners, makeListReferrals, makeRegister, makeSubmitReferral, makeUpdatePartner, makeUpdateReferral, REFERRAL_LIMIT, REGISTER_LIMIT } from './handlers';

// Fakes only — nothing touches a database or replaces a shared module.
const counts = new Map<string, number>();
const isLimited = mock(async (id: string, opts: { max: number }) => (counts.get(id) ?? 0) >= opts.max);
const record = mock(async (id: string) => void counts.set(id, (counts.get(id) ?? 0) + 1));
const register = mock(async () => ({ status: 'registered', code: 'GP-1001', firstName: 'Asha' }));
const submitReferral = mock(async (input: Record<string, unknown>) => {
  if (input.partnerCode !== 'GP-1001') throw new ValidationError('That mobile number and Partner code do not match.');
  return { status: 'received' };
});
const pub = { isLimited, record, register, submitReferral };

let session: { user: { id: string } } | null = null;
const requireAdmin = mock(async () => session);
const staff = {
  requireAdmin,
  listPartners: mock(async () => []),
  stats: mock(async () => ({ partners: 0 })),
  updatePartner: mock(async () => ({})),
  listReferrals: mock(async () => []),
  updateReferral: mock(async () => ({})),
};
const post = (body: unknown, ip = '1.2.3.4') => new NextRequest('https://www.shaadishopping.com/api/x', { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': ip } });
const get = (qs = '') => new NextRequest(`https://www.shaadishopping.com/api/x${qs}`);
const ctx = { params: Promise.resolve({ id: 'x1' }) };

beforeEach(() => {
  counts.clear();
  session = null;
  for (const m of [isLimited, record, register, submitReferral, ...Object.values(staff)]) m.mockClear();
});

describe('public forms', () => {
  test('registration returns only what the service returns; never cached', async () => {
    const res = await makeRegister(pub)(post({ name: 'Asha' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { status: 'registered', code: 'GP-1001', firstName: 'Asha' } });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  test('registration: 5 per 15 minutes per IP, then 429 without calling the service', async () => {
    for (let i = 0; i < REGISTER_LIMIT.max; i++) expect((await makeRegister(pub)(post({}))).status).toBe(200);
    expect((await makeRegister(pub)(post({}))).status).toBe(429);
    expect(register).toHaveBeenCalledTimes(REGISTER_LIMIT.max);
    expect((await makeRegister(pub)(post({}, '5.6.7.8'))).status).toBe(200); // another IP is unaffected
  });

  test('referrals: wrong codes count toward the limit, so codes cannot be guessed', async () => {
    for (let i = 0; i < REFERRAL_LIMIT.max; i++) expect((await makeSubmitReferral(pub)(post({ partnerCode: `GP-${2000 + i}` }))).status).toBe(400);
    expect((await makeSubmitReferral(pub)(post({ partnerCode: 'GP-1001' }))).status).toBe(429); // even the right code, now
  });

  test('a malformed body is treated as empty input, not a crash', async () => {
    const req = new NextRequest('https://x/api', { method: 'POST', body: 'not json', headers: { 'x-forwarded-for': '9.9.9.9' } });
    expect((await makeSubmitReferral(pub)(req)).status).toBe(400);
  });
});

describe('staff routes', () => {
  test('without a staff session: 401 and nothing read or written', async () => {
    expect((await makeListPartners(staff)(get())).status).toBe(401);
    expect((await makeUpdatePartner(staff)(post({ status: 'APPROVED' }), ctx)).status).toBe(401);
    expect((await makeListReferrals(staff)(get())).status).toBe(401);
    expect((await makeUpdateReferral(staff)(post({ status: 'VERIFIED' }), ctx)).status).toBe(401);
    for (const m of [staff.listPartners, staff.updatePartner, staff.listReferrals, staff.updateReferral]) expect(m).not.toHaveBeenCalled();
  });

  test('filters are passed only when valid', async () => {
    session = { user: { id: 'staff-1' } };
    await makeListPartners(staff)(get('?status=APPROVED&city=Patna'));
    expect(staff.listPartners).toHaveBeenCalledWith({ status: 'APPROVED', city: 'Patna' });
    await makeListReferrals(staff)(get('?status=WHATEVER&type=VENUE'));
    expect(staff.listReferrals).toHaveBeenCalledWith({ status: undefined, type: 'VENUE', partnerId: undefined });
  });
});
