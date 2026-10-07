import { Role, ADMIN_ROLES } from '@/lib/auth/roles';

// ---------------------------------------------------------------------------------------------------------------------------
// The one permission model of Vivah OS (founder decision, 7 Oct 2026):
//
//     Person (User)  →  Business Membership  →  Role  →  Permissions
//
// A person signs in as themselves (their own mobile number + their own 6-digit code). What they may do is decided by their
// MEMBERSHIP of the business they are working in: its role gives a default set of permissions, and the owner may add to or take
// from that set for that one person. Nothing here is about pages — a permission names an ability, and the SERVER asks `can()`
// before it reads or changes anything (services and API routes). Screens only hide what the server would refuse anyway.
//
// Pure and client-safe (no database, no Node imports): the Team screen shows these names and defaults.
// ---------------------------------------------------------------------------------------------------------------------------

export const PERMISSIONS = [
  'enquiries', // see and work the business's enquiries (add, follow up, close)
  'quotations', // make, send and revise quotations
  'weddings', // manage booked weddings / events
  'tasks', // give out work and manage the team's tasks
  'catalog', // what the business offers and its price list
  'view_financials', // see payments received, amounts due and business totals
  'edit_financials', // record payments and change payment details
  'team', // add and remove people, set their roles and permissions
  'settings', // the business profile and settings
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  enquiries: 'Enquiries',
  quotations: 'Quotations',
  weddings: 'Weddings and events',
  tasks: 'Tasks and team work',
  catalog: 'What we offer and prices',
  view_financials: 'See payments and totals',
  edit_financials: 'Record and change payments',
  team: 'Manage the team',
  settings: 'Business profile and settings',
};

// The two that expose money. Never part of a default set except the owner's.
export const FINANCIAL_PERMISSIONS: readonly Permission[] = ['view_financials', 'edit_financials'];

// OWNER: the business is theirs — everything, always. MANAGER: runs the day-to-day work; no money unless the owner says so.
// EMPLOYEE: their own assigned work only, until the owner gives more. STAFF: the role that existed before this model
// (enquiries, quotations, weddings — not settings or money); kept so nothing that used it changes.
export type MemberRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE' | 'STAFF';
export const MEMBER_ROLES: readonly MemberRole[] = ['OWNER', 'MANAGER', 'EMPLOYEE', 'STAFF'];
// The roles an owner can give someone from the Team screen (STAFF is legacy; OWNER is not handed out there).
export const ASSIGNABLE_ROLES: readonly MemberRole[] = ['MANAGER', 'EMPLOYEE'];

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = { OWNER: 'Owner', MANAGER: 'Manager', EMPLOYEE: 'Employee', STAFF: 'Staff' };

export const ROLE_DEFAULTS: Record<MemberRole, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  MANAGER: ['enquiries', 'quotations', 'weddings', 'tasks', 'catalog'],
  EMPLOYEE: [],
  STAFF: ['enquiries', 'quotations', 'weddings'],
};

export const isPermission = (value: unknown): value is Permission => (PERMISSIONS as readonly string[]).includes(value as string);
export const isMemberRole = (value: unknown): value is MemberRole => (MEMBER_ROLES as readonly string[]).includes(value as string);

// What one membership may do: the role's defaults, plus what the owner added for this person, minus what the owner took away.
// An owner is never reduced. Unknown names (a permission retired later, a typo in old data) are ignored, never granted.
export function effectivePermissions(member: { role: MemberRole; grants?: readonly string[] | null; denies?: readonly string[] | null }): Permission[] {
  if (member.role === 'OWNER') return [...PERMISSIONS];
  const allowed = new Set<Permission>(ROLE_DEFAULTS[member.role] ?? []);
  for (const g of member.grants ?? []) if (isPermission(g)) allowed.add(g);
  for (const d of member.denies ?? []) if (isPermission(d)) allowed.delete(d);
  return PERMISSIONS.filter((p) => allowed.has(p));
}

// The question every server check asks. `scope` is the business the request is running as (lib/ownership/scope.ts): a scope that
// carries an explicit permission list uses it; one that carries only a role (older entry points) uses that role's defaults.
export function can(scope: { kind: string; role?: MemberRole; permissions?: readonly Permission[] }, permission: Permission): boolean {
  if (scope.kind !== 'BUSINESS' || !scope.role) return false;
  if (scope.role === 'OWNER') return true;
  return (scope.permissions ?? ROLE_DEFAULTS[scope.role] ?? []).includes(permission);
}

// For the Team form: the owner ticks the exact set a person should have; this turns it into what is stored — only the
// differences from the role's defaults, so a later change to a role's defaults still reaches everyone who was not customised.
export function grantsAndDenies(role: MemberRole, wanted: readonly Permission[]): { grants: Permission[]; denies: Permission[] } {
  const defaults = new Set(ROLE_DEFAULTS[role]);
  const want = new Set(wanted);
  return { grants: PERMISSIONS.filter((p) => want.has(p) && !defaults.has(p)), denies: PERMISSIONS.filter((p) => defaults.has(p) && !want.has(p)) };
}

// ---- the internal team's portal roles (unchanged) ----
// Which DOOR a login may walk through (/admin) is still the UserRole; what they may do inside a business is the model above.

export function isAdminRole(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

export function isSuperAdmin(role: Role): boolean {
  return role === Role.SUPER_ADMIN;
}

// Array-aware variants — a User can hold multiple roles since the Step 4
// schema review (2026-07-19). Single-role checkers above stay useful for
// checking one specific role value; these are for a session's full role set.
export function hasAdminRole(roles: Role[]): boolean {
  return roles.some(isAdminRole);
}

export function hasSuperAdmin(roles: Role[]): boolean {
  return roles.includes(Role.SUPER_ADMIN);
}
