import { Role, ADMIN_ROLES } from '@/lib/auth/roles';

// Deliberately minimal for Milestone 1 (infrastructure only) — no CRM
// permission matrix yet. Expand as real protected routes are built.
export function isAdminRole(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

export function isSuperAdmin(role: Role): boolean {
  return role === Role.SUPER_ADMIN;
}
