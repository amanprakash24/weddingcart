import { Role } from '@/generated/prisma/enums';

export { Role };

export const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SALES];
export const PORTAL_ROLES: Role[] = [Role.VENDOR, Role.CUSTOMER];
