/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { effectivePermissions, PERMISSIONS, type MemberRole, type Permission } from '@/lib/auth/permissions';
import { effectiveScope } from './scope';

// Permissions are enforced on the SERVER, at the entry to every Vendor OS route (lib/ownership/venueEntry.ts) — the same model
// the screens read (lib/auth/permissions.ts). Two guards here:
//   1. the wrapper really refuses: 401 / 409 / 403 before the handler runs, with fakes passed in (no shared module is mocked);
//   2. no Vendor OS route can be added without saying what it needs.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createVenueScoped, MEMBER } = await import('./venueEntry');

type W = { businessId: string; name: string; kind: 'VENDOR' | 'PLATFORM'; role: MemberRole; jobTitle: string | null; permissions: Permission[] };
const workspace = (businessId: string, role: MemberRole, grants: Permission[] = [], kind: 'VENDOR' | 'PLATFORM' = 'VENDOR'): W => ({ businessId, name: businessId, kind, role, jobTitle: null, permissions: effectivePermissions({ role, grants }) });

function entry(opts: { userId?: string | null; chosen?: string | null; workspaces?: W[] }) {
  const all = opts.workspaces ?? [];
  const vendorSide = all.filter((w) => w.kind === 'VENDOR');
  return createVenueScoped({
    signedInUserId: async () => (opts.userId === undefined ? 'u1' : opts.userId),
    chosenWorkspace: async () => opts.chosen ?? null,
    workspaces: async () => all,
    scopeFor: async (userId, chosen) => {
      const pick = vendorSide.find((w) => w.businessId === chosen) ?? (vendorSide.length === 1 ? vendorSide[0] : undefined);
      return pick ? { kind: 'BUSINESS', businessId: pick.businessId, role: pick.role, permissions: pick.permissions, userId } : null;
    },
  });
}

const handler = mock(async () => effectiveScope());
const status = async (r: unknown) => (r as Response).status;

describe('venueScoped — who gets in', () => {
  test('not signed in → 401, and the handler never runs', async () => {
    handler.mockClear();
    const res = await entry({ userId: null })(handler, MEMBER)();
    expect(await status(res)).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  test('signed in but not a member of any vendor business → 401', async () => {
    handler.mockClear();
    expect(await status(await entry({ workspaces: [] })(handler, MEMBER)())).toBe(401);
    expect(await status(await entry({ workspaces: [workspace('shaadi-shopping', 'OWNER', [], 'PLATFORM')] })(handler, MEMBER)())).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  test('a member of several businesses who has not chosen one → 409 "choose workspace"; nothing runs', async () => {
    handler.mockClear();
    const res = (await entry({ workspaces: [workspace('venue-a', 'MANAGER'), workspace('decor-b', 'EMPLOYEE')] })(handler, MEMBER)()) as Response;
    expect(res.status).toBe(409);
    expect((await res.json()).chooseWorkspace).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });

  test('the handler runs AS the chosen business, carrying the person and their permissions', async () => {
    const scope = await entry({ chosen: 'decor-b', workspaces: [workspace('venue-a', 'MANAGER'), workspace('decor-b', 'EMPLOYEE', ['weddings'])] })(handler, MEMBER)();
    expect(scope).toEqual({ kind: 'BUSINESS', businessId: 'decor-b', role: 'EMPLOYEE', permissions: ['weddings'], userId: 'u1' });
  });
});

describe('venueScoped — what they may do (the server decides, not the screen)', () => {
  const manager = [workspace('venue-a', 'MANAGER')];
  const trustedManager = [workspace('venue-a', 'MANAGER', ['view_financials', 'edit_financials'])];
  const employee = [workspace('venue-a', 'EMPLOYEE')];
  const owner = [workspace('venue-a', 'OWNER')];
  const attempt = async (workspaces: W[], need: Parameters<ReturnType<typeof createVenueScoped>>[1]) => {
    handler.mockClear();
    const res = await entry({ workspaces })(handler, need)();
    return { ran: handler.mock.calls.length === 1, status: res instanceof Response ? res.status : 200 };
  };

  test('a manager works enquiries and quotations', async () => {
    expect(await attempt(manager, 'enquiries')).toEqual({ ran: true, status: 200 });
    expect(await attempt(manager, 'quotations')).toEqual({ ran: true, status: 200 });
  });

  test('a manager is REFUSED money, the team and settings — 403, and the handler never runs', async () => {
    for (const need of ['view_financials', 'edit_financials', 'team', 'settings'] as const) expect(await attempt(manager, need)).toEqual({ ran: false, status: 403 });
  });

  test('a manager the owner trusted with money gets it — and still not the team or settings', async () => {
    expect(await attempt(trustedManager, 'edit_financials')).toEqual({ ran: true, status: 200 });
    expect(await attempt(trustedManager, 'team')).toEqual({ ran: false, status: 403 });
  });

  test('an employee is refused everything that needs a permission, and allowed what any member may do', async () => {
    for (const need of PERMISSIONS) expect(await attempt(employee, need)).toEqual({ ran: false, status: 403 });
    expect(await attempt(employee, MEMBER)).toEqual({ ran: true, status: 200 });
  });

  test('"any one of" — a route two kinds of people need', async () => {
    expect(await attempt(manager, ['catalog', 'quotations'])).toEqual({ ran: true, status: 200 });
    expect(await attempt(employee, ['catalog', 'quotations'])).toEqual({ ran: false, status: 403 });
  });

  test('the owner is never refused', async () => {
    for (const need of PERMISSIONS) expect(await attempt(owner, need)).toEqual({ ran: true, status: 200 });
  });
});

describe('every Vendor OS route says what it needs', () => {
  const root = join(import.meta.dir, '..', '..');
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
  const routes = files(join(root, 'app', 'api', 'vendor-os')).filter((p) => p.endsWith('route.ts'));
  const rel = (p: string) => p.slice(root.length + 1).replace(/\\/g, '/');

  test('there are routes to check', () => {
    expect(routes.length).toBeGreaterThanOrEqual(20);
  });

  test('each export passes a permission (or MEMBER, said out loud) to venueScoped', () => {
    for (const r of routes) {
      const src = readFileSync(r, 'utf8');
      const exported = [...src.matchAll(/^export const (GET|POST|PUT|PATCH|DELETE) = venueScoped\((.*)\);\s*$/gm)];
      expect({ route: rel(r), exports: exported.length > 0 }).toEqual({ route: rel(r), exports: true });
      for (const e of exported) {
        const need = e[2].split(',').slice(1).join(',').trim();
        const named = need === 'MEMBER' || (/^('[a-z_]+'|\[('[a-z_]+'(, )?)+\])$/.test(need) && [...need.matchAll(/'([a-z_]+)'/g)].every((m) => (PERMISSIONS as readonly string[]).includes(m[1])));
        expect({ route: rel(r), verb: e[1], need, named }).toEqual({ route: rel(r), verb: e[1], need, named: true });
      }
    }
  });

  test('money is never behind anything but a financial permission', () => {
    const payments = readFileSync(join(root, 'app', 'api', 'vendor-os', 'enquiries', '[id]', 'quotation', 'payments', 'route.ts'), 'utf8');
    expect(payments).toContain("venueScoped(handlePOST, 'edit_financials')");
  });
});
