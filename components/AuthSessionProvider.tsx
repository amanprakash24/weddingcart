'use client';

import { SessionProvider } from 'next-auth/react';

// Thin client-boundary wrapper — RootLayout (app/layout.tsx) is a Server
// Component and can't use 'use client' itself, but can render this.
export default function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
