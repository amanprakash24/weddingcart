import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'admin_session';

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function validTokens(): Promise<string[]> {
  const secret = process.env.ADMIN_SECRET || 'fallback-secret';
  const [adminToken, superToken] = await Promise.all([
    hmacHex(secret, `${process.env.ADMIN_USERNAME}:${process.env.ADMIN_PASSWORD}`),
    hmacHex(secret, `${process.env.SUPER_ADMIN_USERNAME}:${process.env.SUPER_ADMIN_PASSWORD}`),
  ]);
  return [adminToken, superToken];
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin/login') || pathname.startsWith('/api/admin/login')) {
    return NextResponse.next();
  }

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  const allowed = await validTokens();
  if (!allowed.includes(token)) {
    const res = NextResponse.redirect(new URL('/admin/login', req.url));
    res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
