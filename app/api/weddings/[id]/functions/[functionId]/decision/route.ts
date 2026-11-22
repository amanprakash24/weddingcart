import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { functionDecisionBody } from '@/lib/wedding/coupleFunctionSchema';
import { coupleFunctionsService } from '@/services/coupleFunctions.service';

// POST /api/weddings/[id]/functions/[functionId]/decision: Shaadi Shopping's team confirms a couple's function at the booked venue, or
// says it is not possible (with the reason the couple reads). Changes nothing about the venue booking, holds or price.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; functionId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = functionDecisionBody.parse(await req.json());
    const { id, functionId } = await params;
    return NextResponse.json({ success: true, data: await coupleFunctionsService.decide(id, functionId, body, session.user.id ?? null) });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
