import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { ADMIN_ROLES, Role } from '@/lib/auth/roles';
import { PLATFORM_BUSINESS_ID } from '@/lib/ownership/owned';
import { checkProfile, type MyProfile, type ProfileErrors } from '@/lib/admin/myProfile';

// "My profile" (lib/admin/myProfile.ts): a member of Shaadi Shopping's own team reads and changes THEIR OWN name, designation and
// photo. The person always comes from the session — there is no way to name anyone else here (the founder names others in Our
// team). The name and photo are on the person's account; the designation is the job title of their place in the Shaadi Shopping
// business. The mobile number, code and password are not changed here (My sign-in).

export interface AdminProfileDeps {
  db: typeof prisma;
  cloudName: () => string | undefined;
}

const defaultDeps = (): AdminProfileDeps => ({ db: prisma, cloudName: () => process.env.CLOUDINARY_CLOUD_NAME });

const mask = (mobile: string) => `${mobile.slice(0, 2)}******${mobile.slice(-2)}`;

export function createAdminProfileService(deps: AdminProfileDeps = defaultDeps()) {
  async function read(userId: string): Promise<MyProfile> {
    const me = await deps.db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true, image: true, passwordHash: true, loginCodeHash: true, createdAt: true, roles: { select: { role: true } } },
    });
    const held = me?.roles.map((r) => r.role).filter((r) => ADMIN_ROLES.includes(r)) ?? [];
    if (!me || held.length === 0) throw new NotFoundError('Profile', userId); // not the internal team — nothing here is for them
    const member = await deps.db.businessMember.findUnique({ where: { businessId_userId: { businessId: PLATFORM_BUSINESS_ID, userId } }, select: { jobTitle: true } });
    const role = held.includes(Role.SUPER_ADMIN) ? 'SUPER_ADMIN' : held.includes(Role.OPERATIONS) ? 'OPERATIONS' : 'SALES';
    return {
      name: me.name,
      designation: member?.jobTitle ?? null,
      photoUrl: me.image,
      role,
      email: me.email,
      mobile: me.phone ? mask(me.phone) : null,
      hasCode: me.loginCodeHash !== null,
      hasPassword: me.passwordHash !== null,
      since: me.createdAt.toISOString(),
    };
  }

  return {
    get: read,

    async update(userId: string, input: Record<string, unknown>): Promise<MyProfile | { errors: ProfileErrors }> {
      await read(userId); // on the team, or nothing
      const checked = checkProfile(input, deps.cloudName());
      if (!checked.ok) return { errors: checked.errors };
      const v = checked.value;
      if (v.name !== undefined || v.photoUrl !== undefined) {
        await deps.db.user.update({ where: { id: userId }, data: { ...(v.name !== undefined ? { name: v.name } : {}), ...(v.photoUrl !== undefined ? { image: v.photoUrl } : {}) } });
      }
      if (v.designation !== undefined) {
        // Everyone on the team has a place in the Shaadi Shopping business (migration 20261007100100). If this one somehow does
        // not, give them the same place that migration would have: a founder owns it, anyone else is a manager who sees money.
        const founder = (await read(userId)).role === 'SUPER_ADMIN';
        await deps.db.businessMember.upsert({
          where: { businessId_userId: { businessId: PLATFORM_BUSINESS_ID, userId } },
          create: { businessId: PLATFORM_BUSINESS_ID, userId, role: founder ? 'OWNER' : 'MANAGER', grants: founder ? [] : ['view_financials', 'edit_financials'], jobTitle: v.designation },
          update: { jobTitle: v.designation },
        });
      }
      return read(userId);
    },
  };
}

export const adminProfileService = createAdminProfileService();
