import { Role, ADMIN_ROLES } from '@/lib/auth/roles';

// Deliberately minimal for Milestone 1 (infrastructure only) — no CRM
// permission matrix yet. Expand as real protected routes are built.
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
