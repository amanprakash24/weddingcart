import { prisma } from '@/lib/prisma';
import { effectiveScope } from '@/lib/ownership/scope';
import { can, effectivePermissions, type MemberRole, type Permission } from '@/lib/auth/permissions';
import { memberLabel } from '@/lib/venue/myWork';

// The people of the business the request runs as — for giving out work (a wedding's to-dos, an enquiry's follow-ups) and for
// naming who has it. BusinessMember is not an owned table, so the business is named here, from the scope — never from a request.
//
// A person's mobile number and first name are read for the ready WhatsApp message "work for you" (lib/venue/myWork.ts). Callers
// pass them on only to someone who may give out work (approved 13 Oct 2026); `names()` is what anyone who sees the work may know.

export interface VenuePerson {
  id: string; // their login's id
  name: string; // how the business names them (lib/venue/myWork.ts memberLabel)
  mobile: string | null; // 10 digits
  firstName: string | null;
  isYou: boolean;
  businessName: string;
  permissions: Permission[];
}

// What a screen that gives out work is sent about each person it can be given to.
export type Assignable = Pick<VenuePerson, 'id' | 'name' | 'mobile' | 'firstName' | 'isYou'>;
export const assignable = ({ id, name, mobile, firstName, isYou }: VenuePerson): Assignable => ({ id, name, mobile, firstName, isYou });

export type VenuePeopleDb = { businessMember: Pick<typeof prisma.businessMember, 'findMany'> };

export function venuePeople(db: VenuePeopleDb) {
  // `ids` = only these (whoever work was given to, even if they have left since); without it, everyone working there today.
  async function members(ids?: string[]): Promise<VenuePerson[]> {
    const scope = effectiveScope();
    if (scope.kind !== 'BUSINESS' || (ids && ids.length === 0)) return [];
    const rows = await db.businessMember.findMany({
      where: { businessId: scope.businessId, ...(ids ? { userId: { in: ids } } : { removedAt: null }) },
      select: { userId: true, role: true, jobTitle: true, grants: true, denies: true, user: { select: { name: true, phone: true } }, business: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({
      id: m.userId,
      name: memberLabel({ name: m.user.name, role: m.role as MemberRole, jobTitle: m.jobTitle }),
      mobile: m.user.phone?.replace(/\D/g, '').slice(-10) || null,
      firstName: m.user.name?.trim().split(/\s+/)[0] || null,
      isYou: m.userId === scope.userId,
      businessName: m.business.name,
      permissions: effectivePermissions({ role: m.role as MemberRole, grants: m.grants, denies: m.denies }),
    }));
  }

  return {
    members,

    // Names only, by id — what anyone who sees the work may know.
    async names(ids: (string | null | undefined)[]): Promise<Map<string, { id: string; name: string }>> {
      const wanted = [...new Set(ids.flatMap((x) => (x ? [x] : [])))];
      return new Map((await members(wanted)).map(({ id, name }) => [id, { id, name }]));
    },

    // Who work is being given to: null = nobody. Refused unless the asker may give out work (`tasks`) and the person works here
    // today — and, when the work needs it (`needs`: a follow-up means calling the couple), may do that kind of work.
    async assignee(raw: unknown, needs?: Permission): Promise<{ ok: true; userId: string | null } | { ok: false; error: string }> {
      const userId = typeof raw === 'string' ? raw.trim() : '';
      if (!can(effectiveScope(), 'tasks')) return { ok: false, error: 'Only the owner or someone who manages the team’s work can give work to a person' };
      if (!userId) return { ok: true, userId: null };
      const person = (await members()).find((p) => p.id === userId);
      if (!person) return { ok: false, error: 'Choose someone who works in your business' };
      if (needs && !person.permissions.includes(needs)) return { ok: false, error: 'This person cannot open your enquiries — let them work on enquiries from the Team screen first' };
      return { ok: true, userId };
    },
  };
}
