import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';
import { coupleChecklistService } from '@/services/coupleChecklistBudget.service';

// PATCH / DELETE /api/customer/weddings/[id]/checklist/[itemId] — tick or untick ({ done }), change an item, or remove it (a
// ready-made item is hidden so it is not added again). The planning permission.
async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const p = await params;
    const userId = session.user.id;
    const body = (await req.json().catch(() => null)) ?? {};
    return NextResponse.json({ success: true, data: await asCoupleWedding(p.id, userId, (): Promise<unknown> => typeof body.done === 'boolean' ? coupleChecklistService.setDone(p.id, p.itemId, body.done, userId) : coupleChecklistService.update(p.id, p.itemId, body, userId), 'plan') }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error);
  }
}

async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const p = await params;
    const userId = session.user.id;
    return NextResponse.json({ success: true, data: await asCoupleWedding(p.id, userId, () => coupleChecklistService.remove(p.id, p.itemId), 'plan') }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error);
  }
}

export const PATCH = platformScoped(handlePATCH);
export const DELETE = platformScoped(handleDELETE);
