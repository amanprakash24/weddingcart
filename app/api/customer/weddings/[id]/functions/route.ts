import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';
import { coupleFunctionBody } from '@/lib/wedding/coupleFunctionSchema';
import { coupleFunctionsService } from '@/services/coupleFunctions.service';

// POST /api/customer/weddings/[id]/functions: the couple adds one of their own functions (My Wedding). At the booked venue it waits
// for staff to confirm (services/coupleFunctions.service.ts). Only the couple of this wedding; anyone else gets "not found".
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = coupleFunctionBody.parse(await req.json());
    const { id } = await params;
    const userId = session.user.id;
    const created = await asCoupleWedding(id, userId, () => coupleFunctionsService.add(id, body, userId));
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

// Record ownership: entered as Shaadi Shopping, then run in the business of the couple's own wedding (lib/customer/coupleEntry.ts).
export const POST = platformScoped(handlePOST);
