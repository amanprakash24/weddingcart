import { NextResponse } from 'next/server';

// Clears the NextAuth JWT session cookie directly rather than using
// next-auth/react's signOut() client helper, so AdminClient.tsx's existing
// fetch('/api/admin/logout') call site doesn't need to change. Both possible
// cookie names are cleared unconditionally (only one is ever set, depending
// on NODE_ENV) — clearing an absent cookie is a harmless no-op.
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set('next-auth.session-token', '', { maxAge: 0, path: '/' });
  res.cookies.set('__Secure-next-auth.session-token', '', { maxAge: 0, path: '/' });
  return res;
}
