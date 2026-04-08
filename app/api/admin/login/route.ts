import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    const token = verifyCredentials(username, password);

    if (!token) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
    return res;
  } catch {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
