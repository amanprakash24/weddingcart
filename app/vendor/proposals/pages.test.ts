/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NotFoundError } from '@/lib/errors';

// Who may open the Vendor Proposal pages (13 Oct 2026: the owner and anyone in the business who may manage its weddings). The
// gate itself — who is signed in, which vendor they are working in, what they may do — is lib/auth/workingVendor.ts (its own
// tests: lib/auth/workingVendor.test.ts); here it is faked, to check that the pages ask it for the right thing and pass on the
// vendor and the money rule it answers. Page-level proxy checks are in lib/auth/logoutEverywhere.test.ts.
type Who = { vendorId: string; can: (p: string) => boolean };
const gate = { answer: null as Who | null, sendTo: '/workspace' };
const redirectTo = (path: string) => Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;replace;${path};307;` });
const sharedPage = mock(async (_need: string | null) => {
  if (!gate.answer) throw redirectTo(gate.sendTo);
  return gate.answer;
});
// Only `sharedPage` is replaced: bun keeps a module mock for the whole run, so the rest of the real module stays as it is for
// the files that test it.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const realGate = await import('@/lib/auth/workingVendor');
mock.module('@/lib/auth/workingVendor', () => ({ ...realGate, sharedPage }));

class VendorProposalNotFoundError extends NotFoundError {
  constructor() {
    super('Proposal', 'unavailable');
  }
}
const listForVendor = mock(async (_vendorId: string, _opts: { seesMoney: boolean }) => []);
const getForVendor = mock(async (_vendorId: string, id: string, _opts: { seesMoney: boolean }) => {
  if (id !== 'q-visible') throw new VendorProposalNotFoundError();
  return { id, number: 'QTN-1', version: 1, status: 'ACCEPTED', wedding: { name: null, date: null, guestCount: null, city: null, eventType: null }, lines: [], total: 0, venue: [] };
});
mock.module('@/services/vendorProposal.service', () => ({ vendorProposalService: { listForVendor, getForVendor } }));

const { default: ListPage } = await import('./page');
const { default: DetailPage } = await import('./[quotationId]/page');
const params = (quotationId: string) => ({ params: Promise.resolve({ quotationId }) });
const member = (vendorId: string, permissions: string[]): Who => ({ vendorId, can: (p) => permissions.includes(p) });

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
  gate.answer = null;
  gate.sendTo = '/workspace';
  for (const m of [sharedPage, listForVendor, getForVendor]) m.mockClear();
});

describe('Vendor Proposal pages — authorization', () => {
  test('both pages ask for the weddings permission, in the vendor the person is working in', async () => {
    gate.answer = member('vendor-A', ['weddings', 'view_financials']);
    await ListPage();
    await DetailPage(params('q-visible'));
    expect(sharedPage.mock.calls.map((c) => c[0])).toEqual(['weddings', 'weddings']);
  });

  test('refused by the gate (not signed in, no business chosen, no permission) → sent away, and no proposal is read', async () => {
    expect(await outcome(() => ListPage())).toBe('redirect:/workspace');
    gate.sendTo = '/vendor/today'; // a member without the permission is sent where their workspace opens
    expect(await outcome(() => DetailPage(params('q-visible')))).toBe('redirect:/vendor/today');
    expect(listForVendor).not.toHaveBeenCalled();
    expect(getForVendor).not.toHaveBeenCalled();
  });

  test('the vendor comes from the gate — never from the URL; an owner gets the amounts', async () => {
    gate.answer = member('vendor-A', ['weddings', 'view_financials']);
    expect(await outcome(() => ListPage())).toBe('rendered');
    expect(await outcome(() => DetailPage(params('q-visible')))).toBe('rendered');
    expect(listForVendor).toHaveBeenCalledWith('vendor-A', { seesMoney: true });
    expect(getForVendor).toHaveBeenCalledWith('vendor-A', 'q-visible', { seesMoney: true });
  });

  test('a manager (weddings, no money) opens them — without amounts', async () => {
    gate.answer = member('vendor-A', ['weddings']);
    await ListPage();
    await DetailPage(params('q-visible'));
    expect(listForVendor).toHaveBeenCalledWith('vendor-A', { seesMoney: false });
    expect(getForVendor).toHaveBeenCalledWith('vendor-A', 'q-visible', { seesMoney: false });
  });

  test('any proposal the vendor may not see is a plain 404', async () => {
    gate.answer = member('vendor-A', ['weddings']);
    expect(await outcome(() => DetailPage(params('someone-elses-quotation')))).toBe('not-found');
  });

  test('other errors are not hidden as 404', async () => {
    gate.answer = member('vendor-A', ['weddings']);
    getForVendor.mockImplementationOnce(async () => {
      throw new Error('db down');
    });
    await expect(DetailPage(params('q-visible'))).rejects.toThrow('db down');
  });
});
