import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { z } from 'zod';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// The wedding team drops this vendor. The service goes back to "needs a vendor". Nothing is sent to the vendor.
const bodySchema = z.object({ reason: z.string().trim().max(300).default('') });

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; vbId: string }> }) {
  const { id, vbId } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;
  try {
    const { reason } = bodySchema.parse(await req.json());
    const result = await weddingWorkspaceService.cancelVendorBooking(id, vbId, reason, session.user.id ?? null);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
