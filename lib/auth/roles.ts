import { Role } from '@/generated/prisma/enums';

export { Role };

// OPERATIONS added in Phase B (docs/wedding-os/01-command-center.md §2) —
// included in ADMIN_ROLES since it's an internal team role, same access class
// as SALES for now; revisit if Operations needs a narrower permission set later.
export const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SALES, Role.OPERATIONS];
export const PORTAL_ROLES: Role[] = [Role.VENDOR, Role.CUSTOMER];

// The roles a sign-in carries when it must not open the Command Center — the WhatsApp one-time code (lib/auth/auth.ts).
export const withoutInternalRoles = (roles: Role[]): Role[] => roles.filter((role) => !ADMIN_ROLES.includes(role));
