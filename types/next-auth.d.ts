import type { Role } from '@/lib/auth/roles';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      role: Role;
      vendorId?: string | null;
    };
  }

  interface User {
    role: Role;
    vendorId?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: Role;
    vendorId?: string | null;
  }
}
