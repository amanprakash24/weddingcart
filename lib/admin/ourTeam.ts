import { normalizeMobile } from '@/lib/auth/vendorCode';

// "Our team" in the Command Center (13 Oct 2026): the founder sees who works at Shaadi Shopping and adds, names, re-codes and
// removes them — name, mobile number, role. Until now a team member could only be made in the database. Pure and browser-safe:
// the form and the server share these rules (services/adminTeam.service.ts).

export const OUR_TEAM_LIMITS = { nameMax: 80, members: 50 } as const;

// What the founder can give here. A second founder is not made from a form.
export type TeamRole = 'SALES' | 'OPERATIONS';
export const TEAM_ROLES: readonly TeamRole[] = ['SALES', 'OPERATIONS'];
export const TEAM_ROLE_LABELS: Record<'SUPER_ADMIN' | TeamRole, string> = { SUPER_ADMIN: 'Founder', SALES: 'Sales', OPERATIONS: 'Operations' };
export const TEAM_ROLE_HELP: Record<TeamRole, string> = {
  SALES: 'Works on leads and quotations.',
  OPERATIONS: 'Works on booked weddings and vendors.',
};

export interface OurTeamMember {
  id: string; // the person
  name: string | null;
  email: string | null;
  mobile: string | null;
  role: 'SUPER_ADMIN' | TeamRole;
  hasCode: boolean;
  hasPassword: boolean;
  isYou: boolean;
  canManage: boolean; // false for a founder (yourself included): a founder's sign-in is changed only by that founder, in My sign-in
}

export type OurTeamField = 'name' | 'mobile' | 'role';
export type OurTeamErrors = Partial<Record<OurTeamField, string>>;

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

export function checkName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = clean(raw);
  if (name.length < 2) return { ok: false, error: 'Their name' };
  if (name.length > OUR_TEAM_LIMITS.nameMax) return { ok: false, error: `Up to ${OUR_TEAM_LIMITS.nameMax} characters` };
  return { ok: true, name };
}

export const isTeamRole = (v: unknown): v is TeamRole => (TEAM_ROLES as readonly string[]).includes(v as string);

export function checkNewTeamMember(input: Record<string, unknown>): { ok: true; value: { name: string; mobile: string; role: TeamRole } } | { ok: false; errors: OurTeamErrors } {
  const errors: OurTeamErrors = {};
  const name = checkName(input.name);
  if (!name.ok) errors.name = name.error;
  const mobile = normalizeMobile(input.mobile);
  if (!mobile) errors.mobile = 'A 10-digit Indian mobile number';
  if (!isTeamRole(input.role)) errors.role = 'Sales or Operations';
  if (!name.ok || !mobile || !isTeamRole(input.role)) return { ok: false, errors };
  return { ok: true, value: { name: name.name, mobile, role: input.role } };
}

// The message the founder sends from their own WhatsApp: the number and the code, and where to sign in.
export function teamLoginMessage(p: { personName: string; mobile: string; code: string; site: string }): string {
  return [
    `Hi ${p.personName.split(' ')[0]}, this is your Shaadi Shopping team sign-in.`,
    `Sign in at ${p.site.replace(/\/$/, '')}/admin/login with:`,
    `Mobile: ${p.mobile}`,
    `Code: ${p.code}`,
    'Please keep this code to yourself.',
  ].join('\n');
}
