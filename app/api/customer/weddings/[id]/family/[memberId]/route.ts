import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';
import { familyService } from '@/services/family.service';

// PATCH / DELETE /api/customer/weddings/[id]/family/[memberId] — the couple changes what a family member can do, or removes them
// (their access ends at once). The couple only.
type Ctx = { params: Promise<{ id: string; memberId: string }> };

async function handlePATCH(req: NextRequest, { params }: Ctx) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { role } = z.object({ role: z.string().max(20) }).parse(await req.json());
    const { id, memberId } = await params;
    const userId = session.user.id;
    return NextResponse.json({ success: true, data: await asCoupleWedding(id, userId, () => familyService.changeRole(id, memberId, role, userId), 'family') });
  } catch (error) {
    return handleApiError(error);
  }
}

async function handleDELETE(_req: NextRequest, { params }: Ctx) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id, memberId } = await params;
    const userId = session.user.id;
    return NextResponse.json({ success: true, data: await asCoupleWedding(id, userId, () => familyService.remove(id, memberId, userId), 'family') });
  } catch (error) {
    return handleApiError(error);
  }
}

export const PATCH = platformScoped(handlePATCH);
export const DELETE = platformScoped(handleDELETE);
