import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { venueScoped } from '@/lib/ownership/venueEntry';
import { functionDecisionBody } from '@/lib/wedding/coupleFunctionSchema';
import { coupleFunctionsService } from '@/services/coupleFunctions.service';
import { readJsonBody } from '@/lib/readJsonBody';

// POST /api/vendor-os/weddings/[id]/functions/[functionId]/decision: the venue's own team (members who may work on weddings) confirms
// a couple's function in its venue, or says it is not possible. Venue-scoped: another business's wedding is "not found".
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; functionId: string }> }) {
  try {
    const body = functionDecisionBody.parse(await readJsonBody(req));
    const { id, functionId } = await params;
    return NextResponse.json({ success: true, data: await coupleFunctionsService.decide(id, functionId, body, (await getSession())?.user?.id ?? null) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST, 'weddings');
