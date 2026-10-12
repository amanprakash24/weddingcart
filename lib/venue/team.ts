import { normalizeMobile } from '@/lib/auth/vendorCode';
import { ASSIGNABLE_ROLES, effectivePermissions, grantsAndDenies, ROLE_DEFAULTS, type MemberRole, type Permission } from '@/lib/auth/permissions';

// The Team screen in Vendor OS (12 Oct 2026 — Phase 2 of "Person → Membership → Role → Permissions", lib/auth/permissions.ts):
// the owner adds the people who work in the business — name, mobile number, role, job title, and whether they may see money.
// Each signs in with their own mobile number and their own 6-digit code. Pure and browser-safe: the form and the server share
// these rules (services/venueTeam.service.ts).

export const TEAM_LIMITS = { nameMax: 80, jobTitleMax: 60, members: 50 } as const;

export interface TeamMemberView {
  id: string; // the membership
  name: string | null;
  mobile: string | null;
  role: MemberRole;
  jobTitle: string | null;
  seesMoney: boolean;
  isYou: boolean;
  canChange: boolean; // false for an owner, and for yourself
}

export interface TeamView {
  members: TeamMemberView[];
  businessName: string;
  canGiveMoney: boolean; // only someone who sees money may let others see it
  roles: readonly MemberRole[]; // what may be given here
}

// What adding someone answered: `code` only when a new login was made for them — readable this once.
export type AddResult =
  | { kind: 'NEW_LOGIN'; member: TeamMemberView; code: string }
  | { kind: 'EXISTING_LOGIN'; member: TeamMemberView } // they already sign in with their own code
  | { kind: 'NEEDS_CODE'; member: TeamMemberView }; // an account with no code yet — Shaadi Shopping issues one, never the owner

export type TeamField = 'name' | 'mobile' | 'role' | 'jobTitle' | 'seesMoney';
export type TeamErrors = Partial<Record<TeamField, string>>;

export interface MemberInput {
  name: string;
  mobile: string;
  role: MemberRole;
  jobTitle: string | null;
  seesMoney: boolean;
}

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

export function checkNewMember(input: Record<string, unknown>): { ok: true; value: MemberInput } | { ok: false; errors: TeamErrors } {
  const errors: TeamErrors = {};
  const name = clean(input.name);
  if (name.length < 2) errors.name = 'Their name';
  else if (name.length > TEAM_LIMITS.nameMax) errors.name = `Up to ${TEAM_LIMITS.nameMax} characters`;
  const mobile = normalizeMobile(input.mobile);
  if (!mobile) errors.mobile = 'A 10-digit Indian mobile number';
  const changes = checkChange(input);
  if (!changes.ok) Object.assign(errors, changes.errors);
  if (Object.keys(errors).length || !mobile || !changes.ok) return { ok: false, errors };
  return { ok: true, value: { name, mobile, role: changes.value.role, jobTitle: changes.value.jobTitle, seesMoney: changes.value.seesMoney } };
}

// Role, job title and money — what can be changed later.
export function checkChange(input: Record<string, unknown>): { ok: true; value: Pick<MemberInput, 'role' | 'jobTitle' | 'seesMoney'> } | { ok: false; errors: TeamErrors } {
  const errors: TeamErrors = {};
  const role = input.role as MemberRole;
  if (!(ASSIGNABLE_ROLES as readonly string[]).includes(role)) errors.role = 'Manager or Employee';
  const jobTitle = clean(input.jobTitle);
  if (jobTitle.length > TEAM_LIMITS.jobTitleMax) errors.jobTitle = `Up to ${TEAM_LIMITS.jobTitleMax} characters`;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { role, jobTitle: jobTitle || null, seesMoney: input.seesMoney === true } };
}

// What is stored for a role and the money switch: only the differences from the role's defaults (grantsAndDenies), so a later
// change to a role's defaults still reaches everyone. "Sees money" = seeing payments and totals; recording payments stays the
// owner's unless given separately later. Anything else the owner had given or taken for this person is kept.
export function memberPermissions(role: MemberRole, seesMoney: boolean, current?: { grants?: readonly string[] | null; denies?: readonly string[] | null }): { grants: Permission[]; denies: Permission[] } {
  const kept = current ? effectivePermissions({ role, grants: current.grants, denies: current.denies }).filter((p) => p !== 'view_financials') : [...ROLE_DEFAULTS[role]].filter((p) => p !== 'view_financials');
  return grantsAndDenies(role, seesMoney ? [...kept, 'view_financials'] : kept);
}

export const ROLE_HELP: Partial<Record<MemberRole, string>> = {
  MANAGER: 'Enquiries, quotations, weddings, tasks and your price list — not money or settings unless you allow it.',
  EMPLOYEE: 'Only the work you give them.',
};

// The message the owner sends from their own WhatsApp: who it is from, the number and the code, and where to sign in.
export function loginMessage(p: { businessName: string; personName: string; mobile: string; code: string; site: string }): string {
  return [
    `Hi ${p.personName.split(' ')[0]}, you have been added to ${p.businessName} on Vivah OS.`,
    `Sign in at ${p.site.replace(/\/$/, '')}/vendor/login with:`,
    `Mobile: ${p.mobile}`,
    `Code: ${p.code}`,
    'Please keep this code to yourself. You can change it after you sign in.',
  ].join('\n');
}
