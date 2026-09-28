import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { endAllSessions } from '@/lib/auth/sessionVersion';

// Logout = end EVERY session of this user (all browsers/devices), then clear this browser's cookie.
// Clearing the cookie always happens, even if the database step fails, so the person who clicked
// "Log out" is never left logged in here; `everywhere` reports whether other devices were ended too.
export async function logoutEverywhere(req: NextRequest): Promise<NextResponse> {
  let everywhere = false;
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (token?.sub) {
      await endAllSessions(token.sub);
      everywhere = true;
    }
  } catch (err) {
    console.error('logout: could not end other sessions', err);
  }

  const res = NextResponse.json({ success: true, everywhere });
  // Both possible cookie names (which one is set depends on NODE_ENV); clearing an absent cookie is a no-op.
  res.cookies.set('next-auth.session-token', '', { maxAge: 0, path: '/' });
  res.cookies.set('__Secure-next-auth.session-token', '', { maxAge: 0, path: '/' });
  return res;
}
