import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { can, type Permission } from '@/lib/auth/permissions';
import { chosenWorkspace } from '@/lib/auth/workspace';
import { venueBusinessService, type BusinessScope, type Workspace } from '@/services/venueBusiness.service';
import { runInScope } from './scope';

// Entry for a business's OWN screens (Phase C; memberships since 7 Oct 2026): the scope is the business the signed-in person is
// working in — resolved from their MEMBERSHIPS and the workspace they chose, never from the request — and everything the handler
// does is limited to it by the database guard. The scope also carries who they are and exactly what they may do there
// (lib/auth/permissions.ts), so the services can ask `can()`.
//
// Not signed in to Vendor OS, or not a member of a vendor business → 401, and nothing runs. A member of several who has not chosen
// one → 409 with `chooseWorkspace`, and nothing runs.
//
// PERMISSIONS ARE ENFORCED HERE, on the server: every route says what it needs —
//
//   export const POST = venueScoped(handlePOST, 'quotations');            // needs that permission
//   export const GET  = venueScoped(handleGET, ['quotations', 'catalog']); // any one of them
//   export const GET  = venueScoped(handleGET, MEMBER);                    // any member of the business (said out loud)
//
// — and a member without it gets 403 before the handler runs. lib/ownership/venuePermissions.test.ts fails CI when a Vendor OS
// route does not say. Hiding a button on a screen is never the control.
export const MEMBER = 'member' as const;
export type Need = Permission | readonly Permission[] | typeof MEMBER;

// What the wrapper needs from the rest of the app — passed in, so its rules are tested with fakes and no shared module is mocked.
export interface VenueEntryDeps {
  signedInUserId: () => Promise<string | null>; // a login that may use Vendor OS, or null
  chosenWorkspace: () => Promise<string | null>;
  scopeFor: (userId: string, workspaceId: string | null) => Promise<BusinessScope | null>;
  workspaces: (userId: string) => Promise<Workspace[]>;
}

const defaultDeps: VenueEntryDeps = {
  signedInUserId: async () => (await requireRole([Role.VENDOR]))?.user?.id ?? null,
  chosenWorkspace,
  scopeFor: (userId, workspaceId) => venueBusinessService.scopeForVendorLogin(userId, workspaceId),
  workspaces: (userId) => venueBusinessService.workspaces(userId),
};

const answer = (status: number, body: Record<string, unknown>) => NextResponse.json({ success: false, ...body }, { status });

export function createVenueScoped(deps: VenueEntryDeps = defaultDeps) {
  return function venueScoped<A extends unknown[], R>(fn: (...args: A) => Promise<R>, need: Need): (...args: A) => Promise<R | NextResponse> {
    return async (...args: A) => {
      const userId = await deps.signedInUserId();
      if (!userId) return answer(401, { error: 'Please log in to your Vivah OS account' });
      const scope = await deps.scopeFor(userId, await deps.chosenWorkspace());
      if (!scope) {
        const several = (await deps.workspaces(userId)).filter((w) => w.kind === 'VENDOR').length > 1;
        return several ? answer(409, { error: 'Choose the business you are working in', chooseWorkspace: true }) : answer(401, { error: 'Please log in to your Vivah OS account' });
      }
      const needs = need === MEMBER ? [] : typeof need === 'string' ? [need as Permission] : [...need];
      if (needs.length > 0 && !needs.some((p) => can(scope, p))) {
        return answer(403, { error: 'You do not have access to this. Ask the owner of the business if you need it.', forbidden: true });
      }
      return runInScope(scope, () => fn(...args));
    };
  };
}

export const venueScoped = createVenueScoped();
