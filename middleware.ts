import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { ADMIN_ROLES, Role } from '@/lib/auth/roles';

// Milestone 4 (Authentication Transition): NextAuth JWT replaces the legacy
// HMAC admin_session cookie. getToken() reads/verifies the JWT cookie
// directly (Edge-compatible, no DB round-trip), unlike lib/auth/session.ts's
// getSession(), which needs the full NextAuth request context middleware
// doesn't have.
const PORTALS: { prefix: string; loginPath: string; roles: Role[] }[] = [
  { prefix: '/admin', loginPath: '/admin/login', roles: ADMIN_ROLES },
  { prefix: '/vendor', loginPath: '/vendor/login', roles: [Role.VENDOR] },
  { prefix: '/customer', loginPath: '/customer/login', roles: [Role.CUSTOMER] },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const portal = PORTALS.find((p) => pathname.startsWith(p.prefix));
  if (!portal) return NextResponse.next();

  // The login page itself must stay reachable while logged out.
  if (pathname.startsWith(portal.loginPath)) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const roles = (token?.roles as Role[] | undefined) ?? [];

  if (!token || !roles.some((role) => portal.roles.includes(role))) {
    return NextResponse.redirect(new URL(portal.loginPath, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/vendor/:path*', '/customer/:path*'],
};
