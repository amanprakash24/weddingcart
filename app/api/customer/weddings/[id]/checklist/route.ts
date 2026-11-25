import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';
import { coupleChecklistService } from '@/services/coupleChecklistBudget.service';

// GET / POST /api/customer/weddings/[id]/checklist — the couple's checklist (25 Nov 2026). Anyone who may see the wedding reads it
// (the ready-made items are added on the first read); adding needs the planning permission.
async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const p = await params;
    const userId = session.user.id;
    return NextResponse.json({ success: true, data: await asCoupleWedding(p.id, userId, () => coupleChecklistService.list(p.id), 'view') }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error);
  }
}

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const p = await params;
    const userId = session.user.id;
    const body = (await req.json().catch(() => null)) ?? {};
    return NextResponse.json({ success: true, data: await asCoupleWedding(p.id, userId, () => coupleChecklistService.add(p.id, body, userId), 'plan') }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = platformScoped(handleGET);
export const POST = platformScoped(handlePOST);
