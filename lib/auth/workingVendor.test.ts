/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { effectivePermissions, type MemberRole, type Permission } from '@/lib/auth/permissions';

// The vendor a person is WORKING in decides what Shaadi Shopping shares with them (13 Oct 2026) — not the vendor they own. Fakes
// are passed in; only '@/lib/prisma' is stubbed because importing the module loads the real services.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createWorkingVendor, createSharedRoute } = await import('./workingVendor');

type W = { businessId: string; name: string; kind: 'VENDOR'; vendorId: string | null; role: MemberRole; jobTitle: string | null; permissions: Permission[] };
const workspace = (businessId: string, vendorId: string | null, role: MemberRole, grants: Permission[] = []): W => ({ businessId, name: `Business ${businessId}`, kind: 'VENDOR', vendorId, role, jobTitle: null, permissions: effectivePermissions({ role, grants }) });

function who(opts: { userId?: string | null; chosen?: string | null; workspaces?: W[] }) {
  const all = opts.workspaces ?? [];
  return createWorkingVendor({
    signedInUserId: async () => (opts.userId === undefined ? 'u1' : opts.userId),
    chosenWorkspace: async () => opts.chosen ?? null,
    working: async (_userId, chosen) => all.find((w) => w.businessId === chosen) ?? (all.length === 1 ? all[0] : null),
  });
}

describe('workingVendor — which vendor, and what the person may do there', () => {
  test('not signed in, in no vendor business, or in several with none chosen → nobody', async () => {
    expect(await who({ userId: null, workspaces: [workspace('a', 'vendor-a', 'OWNER')] })()).toBeNull();
    expect(await who({ workspaces: [] })()).toBeNull();
    expect(await who({ workspaces: [workspace('a', 'vendor-a', 'OWNER'), workspace('b', 'vendor-b', 'MANAGER')] })()).toBeNull();
  });

  test('a manager with no vendor of their own works in the owner’s vendor, without money', async () => {
    const w = await who({ workspaces: [workspace('a', 'vendor-a', 'MANAGER')] })();
    expect(w).toMatchObject({ userId: 'u1', businessId: 'a', vendorId: 'vendor-a', role: 'MANAGER', home: '/vendor/today' });
    expect([w!.can('weddings'), w!.can('enquiries'), w!.can('view_financials'), w!.can('team')]).toEqual([true, true, false, false]);
  });

  test('someone who owns one vendor and works in another gets the one they CHOSE — never their own by default', async () => {
    const both = [workspace('own', 'vendor-own', 'OWNER'), workspace('other', 'vendor-other', 'EMPLOYEE', ['weddings'])];
    const there = await who({ chosen: 'other', workspaces: both })();
    expect(there).toMatchObject({ vendorId: 'vendor-other', role: 'EMPLOYEE' });
    expect([there!.can('weddings'), there!.can('view_financials')]).toEqual([true, false]);
    expect(await who({ chosen: 'own', workspaces: both })()).toMatchObject({ vendorId: 'vendor-own', role: 'OWNER' });
  });
});

describe('sharedRoute — the answer a route on Shaadi Shopping’s shared records gives', () => {
  const route = (opts: Parameters<typeof who>[0]) => createSharedRoute(who(opts));
  const status = (r: { who: unknown } | { refused: Response }) => ('refused' in r ? r.refused.status : 200);

  test('401 for nobody; 403 without the permission; 404 for a business with no listing; otherwise the vendor', async () => {
    expect(status(await route({ userId: null })('weddings'))).toBe(401);
    expect(status(await route({ workspaces: [workspace('a', 'vendor-a', 'EMPLOYEE')] })('weddings'))).toBe(403);
    expect(status(await route({ workspaces: [workspace('a', 'vendor-a', 'MANAGER')] })('view_financials'))).toBe(403);
    expect(status(await route({ workspaces: [workspace('a', null, 'OWNER')] })('weddings'))).toBe(404);
    const ok = await route({ workspaces: [workspace('a', 'vendor-a', 'MANAGER')] })('weddings');
    expect('who' in ok && ok.who).toMatchObject({ vendorId: 'vendor-a', userId: 'u1' });
  });
});
