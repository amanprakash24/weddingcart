import { prisma } from '@/lib/prisma';
import type { Scope } from '@/lib/ownership/scope';
import { effectivePermissions, type MemberRole, type Permission } from '@/lib/auth/permissions';

// A person's place in a business (7 Oct 2026):  Person (User) → Business Membership → Role → Permissions.
//
// A vendor's own business in Vivah OS (docs/wedding-os/15-record-ownership.md §4.1–4.2) used to have exactly one login — the
// vendor's owner, tied to it by VendorProfile. Now a business has MEMBERS (BusinessMember): its owner, managers and employees,
// each signing in as themselves. One person may be a member of several businesses; the WORKSPACE they chose says which one a
// request works in, and it is checked against their memberships on every request — never trusted.
//
// The owner link still works exactly as before: the first time a vendor's owner works on its own records, the vendor gets its
// Business (kind VENDOR) with that login as Owner. Business and BusinessMember are not owned tables, so this runs without a scope.
// Never takes a business id on trust.

export interface VenueBusinessDeps {
  db: {
    vendorProfile: Pick<typeof prisma.vendorProfile, 'findUnique'>;
    business: Pick<typeof prisma.business, 'findUnique' | 'create'>;
    businessMember: Pick<typeof prisma.businessMember, 'findUnique' | 'create' | 'findMany'>;
  };
}

const defaultDeps = (): VenueBusinessDeps => ({ db: prisma });

const isUniqueViolation = (err: unknown) => (err as { code?: string })?.code === 'P2002';

export type BusinessScope = Extract<Scope, { kind: 'BUSINESS' }>;

// One business a person can work in — what "Choose Workspace" lists.
export interface Workspace {
  businessId: string;
  name: string;
  kind: 'PLATFORM' | 'VENDOR';
  vendorId: string | null; // the vendor this business is, if it is one — to tell a person's OWN vendor from another they work in
  role: MemberRole;
  jobTitle: string | null;
  permissions: Permission[];
}

const memberSelect = { role: true, jobTitle: true, grants: true, denies: true, business: { select: { id: true, name: true, kind: true, vendorId: true } } } as const;

export function createVenueBusinessService(deps: VenueBusinessDeps = defaultDeps()) {
  // The owner link from before memberships: a login tied to a vendor by VendorProfile owns that vendor's business. Makes the
  // Business and the Owner membership the first time, exactly as it always did. Nothing happens for anyone else.
  async function ensureOwnerMembership(userId: string): Promise<void> {
    const profile = await deps.db.vendorProfile.findUnique({ where: { userId }, select: { vendorId: true, vendor: { select: { name: true } } } });
    if (!profile) return;
    let business = await deps.db.business.findUnique({ where: { vendorId: profile.vendorId }, select: { id: true, kind: true } });
    if (!business) {
      try {
        business = await deps.db.business.create({ data: { name: profile.vendor.name, kind: 'VENDOR', vendorId: profile.vendorId }, select: { id: true, kind: true } });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err; // two first requests at once: the other one created it
        business = await deps.db.business.findUnique({ where: { vendorId: profile.vendorId }, select: { id: true, kind: true } });
      }
    }
    if (!business || business.kind !== 'VENDOR') return;
    const member = await deps.db.businessMember.findUnique({ where: { businessId_userId: { businessId: business.id, userId } }, select: { role: true } });
    if (member) return;
    try {
      await deps.db.businessMember.create({ data: { businessId: business.id, userId, role: 'OWNER' } });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }

  // Every business this person is a member of today (someone removed from a team is not), Shaadi Shopping's own team included.
  async function workspaces(userId: string): Promise<Workspace[]> {
    await ensureOwnerMembership(userId);
    const rows = await deps.db.businessMember.findMany({ where: { userId, removedAt: null }, select: memberSelect, orderBy: { createdAt: 'asc' } });
    return rows.map((m) => ({
      businessId: m.business.id,
      name: m.business.name,
      kind: m.business.kind,
      vendorId: m.business.vendorId,
      role: m.role,
      jobTitle: m.jobTitle,
      permissions: effectivePermissions({ role: m.role, grants: m.grants, denies: m.denies }),
    }));
  }

  const toScope = (w: Workspace, userId: string): BusinessScope => ({ kind: 'BUSINESS', businessId: w.businessId, role: w.role, permissions: w.permissions, userId });

  return {
    workspaces,

    // The scope a person works in on the vendor side (Vendor OS). `workspaceId` is the business they chose; it counts only if they
    // are a member of it. With no choice: their only vendor business, if they have exactly one. null = not a member of any vendor
    // business, or a member of several with none chosen (they are sent to "Choose Workspace").
    async scopeForVendorLogin(userId: string, workspaceId?: string | null): Promise<BusinessScope | null> {
      const vendorSide = (await workspaces(userId)).filter((w) => w.kind === 'VENDOR');
      const chosen = workspaceId ? vendorSide.find((w) => w.businessId === workspaceId) : undefined;
      const pick = chosen ?? (vendorSide.length === 1 ? vendorSide[0] : undefined);
      return pick ? toScope(pick, userId) : null;
    },

    // The scope a member of Shaadi Shopping's own team works in (the Command Center); null for anyone who is not one.
    async scopeForPlatform(userId: string): Promise<BusinessScope | null> {
      const own = (await workspaces(userId)).find((w) => w.kind === 'PLATFORM');
      return own ? toScope(own, userId) : null;
    },
  };
}

export const venueBusinessService = createVenueBusinessService();
