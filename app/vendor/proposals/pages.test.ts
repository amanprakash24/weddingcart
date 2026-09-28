/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NotFoundError } from '@/lib/errors';

// Who may open the Vendor Proposal pages. The session and the vendor proposal service are faked (same pattern as the
// quotation route tests); requireRole keeps its real meaning — a session is returned only when the user has one of
// the allowed roles. Page-level proxy checks are in lib/auth/logoutEverywhere.test.ts.
const session = { current: null as { user: { id: string; roles: string[] } } | null };
const requireRole = mock(async (allowed: string[]) => (session.current && session.current.user.roles.some((r) => allowed.includes(r)) ? session.current : null));
mock.module('@/lib/auth/session', () => ({ requireRole, getSession: mock(async () => session.current) }));

class VendorProposalNotFoundError extends NotFoundError {
  constructor() {
    super('Proposal', 'unavailable');
  }
}
const listForVendor = mock(async (userId: string) => {
  if (userId !== 'user-A') throw new NotFoundError('Vendor profile', userId);
  return [];
});
const getForVendor = mock(async (userId: string, id: string) => {
  if (userId !== 'user-A') throw new NotFoundError('Vendor profile', userId);
  if (id !== 'q-visible') throw new VendorProposalNotFoundError();
  return { id, number: 'QTN-1', version: 1, status: 'ACCEPTED', wedding: { name: null, date: null, guestCount: null, city: null, eventType: null }, lines: [], total: 0, venue: [] };
});
mock.module('@/services/vendorProposal.service', () => ({ vendorProposalService: { listForVendor, getForVendor } }));

const { default: ListPage } = await import('./page');
const { default: DetailPage } = await import('./[quotationId]/page');
const params = (quotationId: string) => ({ params: Promise.resolve({ quotationId }) });

// Next's redirect()/notFound() throw errors carrying a digest; this reads which one happened.
async function outcome(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return 'rendered';
  } catch (err) {
    const digest = String((err as { digest?: string }).digest ?? (err as Error).message);
    if (digest.startsWith('NEXT_REDIRECT')) return `redirect:${digest.split(';')[2]}`;
    if (digest.includes('404') || digest.includes('NOT_FOUND')) return 'not-found';
    throw err;
  }
}

beforeEach(() => {
  session.current = null;
  for (const m of [requireRole, listForVendor, getForVendor]) m.mockClear();
});

describe('Vendor Proposal pages — authorization', () => {
  test('unauthenticated → sent to the vendor login, no data read', async () => {
    expect(await outcome(() => ListPage())).toBe('redirect:/vendor/login');
    expect(await outcome(() => DetailPage(params('q-visible')))).toBe('redirect:/vendor/login');
    expect(listForVendor).not.toHaveBeenCalled();
    expect(getForVendor).not.toHaveBeenCalled();
  });

  test.each([['SUPER_ADMIN'], ['ADMIN'], ['CUSTOMER']])('a %s cannot use the Vendor OS as a vendor', async (role) => {
    session.current = { user: { id: 'someone', roles: [role] } };
    expect(await outcome(() => ListPage())).toBe('redirect:/vendor/login');
    expect(await outcome(() => DetailPage(params('q-visible')))).toBe('redirect:/vendor/login');
    expect(getForVendor).not.toHaveBeenCalled();
  });

  test('only the VENDOR role is accepted', async () => {
    session.current = { user: { id: 'user-A', roles: ['VENDOR'] } };
    await ListPage();
    expect(requireRole).toHaveBeenCalledWith(['VENDOR']);
  });

  test('a vendor-role user without a vendor profile gets 404', async () => {
    session.current = { user: { id: 'user-no-profile', roles: ['VENDOR'] } };
    expect(await outcome(() => ListPage())).toBe('not-found');
    expect(await outcome(() => DetailPage(params('q-visible')))).toBe('not-found');
  });

  test('a vendor sees their list and a proposal they may see; the session user id — not the URL — picks the vendor', async () => {
    session.current = { user: { id: 'user-A', roles: ['VENDOR'] } };
    expect(await outcome(() => ListPage())).toBe('rendered');
    expect(await outcome(() => DetailPage(params('q-visible')))).toBe('rendered');
    expect(getForVendor).toHaveBeenCalledWith('user-A', 'q-visible');
  });

  test('any proposal the vendor may not see is a plain 404', async () => {
    session.current = { user: { id: 'user-A', roles: ['VENDOR'] } };
    expect(await outcome(() => DetailPage(params('someone-elses-quotation')))).toBe('not-found');
  });

  test('other errors are not hidden as 404', async () => {
    session.current = { user: { id: 'user-A', roles: ['VENDOR'] } };
    getForVendor.mockImplementationOnce(async () => {
      throw new Error('db down');
    });
    await expect(DetailPage(params('q-visible'))).rejects.toThrow('db down');
  });
});
