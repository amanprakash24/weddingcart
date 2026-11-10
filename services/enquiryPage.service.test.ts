/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { runInScope, type Scope } from '@/lib/ownership/scope';

// A venue's public enquiry page (services/enquiryPage.service.ts). A fake database; nothing real is touched.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createEnquiryPageService, isWellFormedSlug, slugCandidates } = await import('./enquiryPage.service');

type Biz = { id: string; name: string; kind: 'PLATFORM' | 'VENDOR'; logoUrl: string | null; enquirySlug: string | null; vendor: { city: string } | null };

function setup(list: Biz[]) {
  const businesses = list.map((b) => ({ ...b }));
  const db = {
    business: {
      findUnique: mock(async (a: { where: { id?: string; enquirySlug?: string } }) => businesses.find((b) => (a.where.id ? b.id === a.where.id : b.enquirySlug === a.where.enquirySlug)) ?? null),
      updateMany: mock(async (a: { where: { id: string; enquirySlug: null }; data: { enquirySlug: string } }) => {
        const b = businesses.find((x) => x.id === a.where.id && x.enquirySlug === null);
        if (b) b.enquirySlug = a.data.enquirySlug;
        return { count: b ? 1 : 0 };
      }),
    },
  };
  const intake = mock(async () => ({ id: 'e-1', repeat: false }));
  const service = createEnquiryPageService({ db: db as never, intake, today: () => '2026-11-11' });
  return { service, db, intake, businesses };
}

const cozy = (over: Partial<Biz> = {}): Biz => ({ id: 'b-cozy', name: 'Touch of Cozy', kind: 'VENDOR', logoUrl: 'https://res.cloudinary.com/x/logo.png', enquirySlug: 'touch-of-cozy', vendor: { city: 'Patna' }, ...over });
const AS_COZY: Scope = { kind: 'BUSINESS', businessId: 'b-cozy', role: 'STAFF' };
const form = { name: 'Neha Sharma', phone: '98765 43210', eventType: 'wedding', functions: ['HALDI'], days: '2', src: 'google', trap: '', openMs: 42000 };

describe('the page address', () => {
  test('made from the venue’s name; numbered when taken', () => {
    expect(slugCandidates('Touch of Cozy').slice(0, 3)).toEqual(['touch-of-cozy', 'touch-of-cozy-2', 'touch-of-cozy-3']);
    expect(slugCandidates('!!!')[0]).toBe('venue');
    expect(isWellFormedSlug('touch-of-cozy')).toBe(true);
    for (const bad of ['', '-x', 'x-', 'Touch', 'a/b', '../x', 'x'.repeat(61), 42]) expect(isWellFormedSlug(bad)).toBe(false);
  });

  test('the first time the team asks, the venue gets the first free address — and keeps it after that', async () => {
    const { service, businesses } = setup([cozy({ id: 'b-other', enquirySlug: 'touch-of-cozy' }), cozy({ enquirySlug: null })]);
    expect(await runInScope(AS_COZY, () => service.ensureSlug())).toBe('touch-of-cozy-2');
    expect(businesses[1].enquirySlug).toBe('touch-of-cozy-2');
    expect(await runInScope(AS_COZY, () => service.ensureSlug())).toBe('touch-of-cozy-2');
  });

  test('Shaadi Shopping itself has no enquiry page', async () => {
    const { service } = setup([cozy({ id: 'shaadi-shopping', kind: 'PLATFORM', enquirySlug: null })]);
    await expect(runInScope({ kind: 'BUSINESS', businessId: 'shaadi-shopping', role: 'OWNER' }, () => service.ensureSlug())).rejects.toThrow();
  });
});

describe('the public page', () => {
  test('shows only the venue’s name, logo and city', async () => {
    const { service } = setup([cozy()]);
    expect(await service.profile('touch-of-cozy')).toEqual({ businessId: 'b-cozy', name: 'Touch of Cozy', logoUrl: 'https://res.cloudinary.com/x/logo.png', city: 'Patna' });
  });

  test('an unknown or malformed address, or the platform’s, is not found — a malformed one never reaches the database', async () => {
    const { service, db } = setup([cozy({ id: 'shaadi-shopping', kind: 'PLATFORM', enquirySlug: 'shaadi' })]);
    expect(await service.profile('nobody')).toBeNull();
    expect(await service.profile('shaadi')).toBeNull();
    const calls = db.business.findUnique.mock.calls.length;
    expect(await service.profile('../admin')).toBeNull();
    expect(db.business.findUnique.mock.calls.length).toBe(calls);
  });
});

describe('sending the form', () => {
  test('goes into the venue’s enquiries through the one intake, recorded as from its link’s place and the enquiry page, given to nobody yet (the owner)', async () => {
    const { service, intake } = setup([cozy()]);
    expect(await runInScope(AS_COZY, () => service.receive('touch-of-cozy', form))).toEqual({ ok: true, firstName: 'Neha', saved: true });
    expect(intake).toHaveBeenCalledWith(expect.objectContaining({ name: 'Neha Sharma', phone: '9876543210', channel: 'GOOGLE', days: 2, functions: ['HALDI'] }), { sourceDetail: 'Enquiry page', actorId: null });
  });

  test('a form filled by a program is thanked like any other — and not saved', async () => {
    const { service, intake } = setup([cozy()]);
    expect(await runInScope(AS_COZY, () => service.receive('touch-of-cozy', { ...form, trap: 'http://spam.example' }))).toEqual({ ok: true, firstName: 'Neha', saved: false });
    expect(await runInScope(AS_COZY, () => service.receive('touch-of-cozy', { ...form, openMs: 400 }))).toMatchObject({ ok: true, saved: false });
    expect(intake).not.toHaveBeenCalled();
  });

  test('mistakes come back one per field; nothing is saved', async () => {
    const { service, intake } = setup([cozy()]);
    expect(await runInScope(AS_COZY, () => service.receive('touch-of-cozy', { ...form, phone: '12345' }))).toEqual({ ok: false, errors: { phone: expect.any(String) } });
    expect(intake).not.toHaveBeenCalled();
  });

  test('never saved as any business but the page’s own, and an unknown page is not found', async () => {
    const { service, intake } = setup([cozy()]);
    await expect(runInScope({ kind: 'BUSINESS', businessId: 'b-other', role: 'STAFF' }, () => service.receive('touch-of-cozy', form))).rejects.toThrow();
    await expect(runInScope(AS_COZY, () => service.receive('nobody', form))).rejects.toThrow();
    expect(intake).not.toHaveBeenCalled();
  });
});
