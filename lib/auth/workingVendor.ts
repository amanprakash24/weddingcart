import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import type { MemberRole, Permission } from '@/lib/auth/permissions';
import { chosenWorkspace } from '@/lib/auth/workspace';
import { vendorHome } from '@/lib/auth/workspaceView';
import { venueBusinessService, type Workspace } from '@/services/venueBusiness.service';

// Who is asking, and which vendor they are working in (13 Oct 2026) — for what Shaadi Shopping SHARES with a vendor: its booking
// requests, the weddings it is booked on, its payouts, its availability requests. Those records are Shaadi Shopping's, so their
// pages and routes run as Shaadi Shopping (lib/ownership/entry.ts) and are limited to one vendor by id. That vendor used to be
// the signed-in person's OWN vendor (the owner link, VendorProfile), which left out everyone else in the business and showed a
// person who owns one vendor and works in another the wrong one. Now it is the vendor of the business they are WORKING in —
// from their memberships and the workspace they chose, the same rule as a business's own screens (lib/ownership/venueEntry.ts) —
// together with what they may do there. Never from the request.
//
// Server only. Permissions are checked here and in the services' queries; the menu only hides what would be refused anyway.
export interface WorkingVendor {
  userId: string;
  businessId: string;
  businessName: string;
  vendorId: string | null; // null: a business with no listing — Shaadi Shopping shares nothing with it
  role: MemberRole;
  can: (permission: Permission) => boolean;
  home: string; // where this workspace opens for this person
}

export interface WorkingVendorDeps {
  signedInUserId: () => Promise<string | null>; // a login that may use Vendor OS, or null
  chosenWorkspace: () => Promise<string | null>;
  working: (userId: string, workspaceId: string | null) => Promise<Workspace | null>;
}

const defaultDeps: WorkingVendorDeps = {
  signedInUserId: async () => (await requireRole([Role.VENDOR]))?.user?.id ?? null,
  chosenWorkspace,
  working: (userId, workspaceId) => venueBusinessService.working(userId, workspaceId),
};

export function createWorkingVendor(deps: WorkingVendorDeps = defaultDeps) {
  return async function workingVendor(): Promise<WorkingVendor | null> {
    const userId = await deps.signedInUserId();
    if (!userId) return null;
    const w = await deps.working(userId, await deps.chosenWorkspace());
    if (!w) return null;
    return {
      userId,
      businessId: w.businessId,
      businessName: w.name,
      vendorId: w.vendorId,
      role: w.role,
      can: (permission) => w.permissions.includes(permission),
      home: vendorHome({ permissions: w.permissions }),
    };
  };
}

export const workingVendor = createWorkingVendor();

export type SharedVendor = WorkingVendor & { vendorId: string };

const answer = (status: number, body: Record<string, unknown>) => NextResponse.json({ success: false, ...body }, { status });

// For a ROUTE on what Shaadi Shopping shares: the vendor and the person, or the answer to send back — 401 not signed in / no
// business chosen, 403 without the permission, 404 when the business has no listing.
export function createSharedRoute(who: () => Promise<WorkingVendor | null> = workingVendor) {
  return async function sharedRoute(need: Permission): Promise<{ who: SharedVendor } | { refused: NextResponse }> {
    const w = await who();
    if (!w) return { refused: answer(401, { error: 'Please log in to your Vivah OS account' }) };
    if (!w.can(need)) return { refused: answer(403, { error: 'You do not have access to this. Ask the owner of the business if you need it.', forbidden: true }) };
    if (!w.vendorId) return { refused: answer(404, { error: 'Not found' }) };
    return { who: w as SharedVendor };
  };
}

export const sharedRoute = createSharedRoute();

// For a PAGE on what Shaadi Shopping shares: the vendor and the person, or they are sent where they can be — "Choose Workspace"
// with no business, this workspace's first screen without the permission, the business profile when there is no listing.
// `need` null = open to every member (Today, which then shows each part by its own permission).
export async function sharedPage(need: Permission | null): Promise<SharedVendor> {
  const w = await workingVendor();
  if (!w) redirect('/workspace');
  if (need && !w.can(need)) redirect(w.home);
  if (!w.vendorId) redirect('/vendor/profile');
  return w as SharedVendor;
}
