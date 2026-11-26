import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';
import { coupleFunctionBody } from '@/lib/wedding/coupleFunctionSchema';
import { coupleFunctionsService } from '@/services/coupleFunctions.service';
import { readJsonBody } from '@/lib/readJsonBody';

// PATCH / DELETE /api/customer/weddings/[id]/functions/[functionId]: the couple changes or removes one of THEIR OWN functions.
// Editing a function set by the planner or the venue is a request: nothing moves until staff confirm it.
type Ctx = { params: Promise<{ id: string; functionId: string }> };

async function handlePATCH(req: NextRequest, { params }: Ctx) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = coupleFunctionBody.parse(await readJsonBody(req));
    const { id, functionId } = await params;
    const userId = session.user.id;
    const updated = await asCoupleWedding(id, userId, () => coupleFunctionsService.update(id, functionId, body, userId), 'plan');
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

async function handleDELETE(_req: NextRequest, { params }: Ctx) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id, functionId } = await params;
    const userId = session.user.id;
    return NextResponse.json({ success: true, data: await asCoupleWedding(id, userId, () => coupleFunctionsService.remove(id, functionId, userId), 'plan') });
  } catch (error) {
    return handleApiError(error);
  }
}

export const PATCH = platformScoped(handlePATCH);
export const DELETE = platformScoped(handleDELETE);
