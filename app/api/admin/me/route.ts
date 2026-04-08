import { NextRequest, NextResponse } from 'next/server';
import { computeAdminToken, computeSuperAdminToken, COOKIE_NAME } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ role: null }, { status: 401 });

  if (token === computeSuperAdminToken()) return NextResponse.json({ role: 'super_admin' });
  if (token === computeAdminToken())      return NextResponse.json({ role: 'admin' });

  return NextResponse.json({ role: null }, { status: 401 });
}
