import type { Role } from '@/lib/auth/roles';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      // Plural since the Step 4 schema review (2026-07-19): one User/phone
      // number can hold multiple roles (e.g. a vendor who also books their
      // own wedding as a customer) — see prisma/schema.prisma's UserRole.
      roles: Role[];
      vendorId?: string | null;
      // The user's sessionVersion when this session was issued (lib/auth/sessionVersion.ts).
      sessionVersion?: number;
    };
  }

  interface User {
    roles: Role[];
    vendorId?: string | null;
    sessionVersion?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    roles: Role[];
    vendorId?: string | null;
    sv?: number;
  }
}
