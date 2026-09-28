/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { ConflictError } from '@/lib/errors';

// Admin link routes. Session and quotation.service are faked (same pattern as ../actions.route.test.ts).
const session = { current: { user: { id: 'staff-1', roles: ['SUPER_ADMIN'] } } as { user: { id: string; roles: string[] } } | null };
const requireRole = mock(async () => session.current);
const issueCustomerLink = mock(async () => ({ token: 'T'.repeat(43) }));
const revokeCustomerLink = mock(async () => {});
mock.module('@/lib/auth/session', () => ({ requireRole, getSession: mock(async () => session.current) }));
mock.module('@/services/quotation.service', () => ({ quotationService: { issueCustomerLink, revokeCustomerLink } }));

const { POST, DELETE } = await import('./route');
const ctx = { params: Promise.resolve({ id: 'q1' }) };
const req = (method: string, origin = 'https://www.shaadishopping.com') => new NextRequest(`${origin}/api/quotations/q1/customer-link`, { method });

beforeEach(() => {
  session.current = { user: { id: 'staff-1', roles: ['SUPER_ADMIN'] } };
  issueCustomerLink.mockClear();
  revokeCustomerLink.mockClear();
  issueCustomerLink.mockImplementation(async () => ({ token: 'T'.repeat(43) }));
});

describe('POST /api/quotations/[id]/customer-link', () => {
  test('returns the new link ONCE, built on the host staff are using, never cached', async () => {
    const res = await POST(req('POST'), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { url: `https://www.shaadishopping.com/proposal/${'T'.repeat(43)}` } });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(issueCustomerLink).toHaveBeenCalledWith('q1', 'staff-1');
  });

  test('a preview deployment gets a preview link', async () => {
    const res = await POST(req('POST', 'https://weddingcart-abc.vercel.app'), ctx);
    expect((await res.json()).data.url.startsWith('https://weddingcart-abc.vercel.app/proposal/')).toBe(true);
  });

  test('not sent / not valid → 409', async () => {
    issueCustomerLink.mockImplementation(async () => { throw new ConflictError('A customer link can only be created for a sent quotation that is still valid'); });
    expect((await POST(req('POST'), ctx)).status).toBe(409);
  });

  test('not staff → 401, nothing created', async () => {
    session.current = null;
    expect((await POST(req('POST'), ctx)).status).toBe(401);
    expect(issueCustomerLink).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/quotations/[id]/customer-link', () => {
  test('revokes', async () => {
    const res = await DELETE(req('DELETE'), ctx);
    expect(res.status).toBe(200);
    expect(revokeCustomerLink).toHaveBeenCalledWith('q1', 'staff-1');
  });

  test('not staff → 401', async () => {
    session.current = null;
    expect((await DELETE(req('DELETE'), ctx)).status).toBe(401);
    expect(revokeCustomerLink).not.toHaveBeenCalled();
  });
});
