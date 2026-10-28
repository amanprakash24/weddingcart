import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { hasSuperAdmin } from '@/lib/auth/permissions';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { coupleLoginService } from '@/services/coupleLogin.service';

// GET  /api/weddings/[id]/couple-login — the couple's My Wedding sign-in, for one of Shaadi Shopping's weddings.
// POST /api/weddings/[id]/couple-login — { action: 'give' } gives the couple My Wedding (a NEW login's code is in this answer only);
//      { action: 'replace' } makes a new code for the couple's existing login — the founder (SUPER_ADMIN) only, since a new code is a
//      way to sign in as them. services/coupleLogin.service.ts has the rules.
const noStore = { 'Cache-Control': 'no-store' };
const unauthorized = () => NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session?.user) return unauthorized();
  try {
    const founder = hasSuperAdmin(session.user.roles ?? []);
    return NextResponse.json({ success: true, data: await coupleLoginService.status((await params).id, founder) }, { headers: noStore });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session?.user) return unauthorized();
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (body?.action === 'replace') {
      if (!hasSuperAdmin(session.user.roles ?? [])) return NextResponse.json({ success: false, error: "Only the founder can replace a couple's code" }, { status: 403 });
      return NextResponse.json({ success: true, data: { kind: 'NEW_CODE', ...(await coupleLoginService.replace(id)) } }, { headers: noStore });
    }
    return NextResponse.json({ success: true, data: await coupleLoginService.give(id) }, { headers: noStore });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const POST = platformScoped(handlePOST);
