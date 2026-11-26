import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { z } from 'zod';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { readJsonBody } from '@/lib/readJsonBody';

// Cancel this vendor and book another one for the same service, in one step. The new booking waits for their yes; nothing is sent.
const bodySchema = z.object({
  vendorId: z.string().trim().min(1),
  agreedPrice: z.number().int().positive(),
  reason: z.string().trim().max(300).optional(),
});

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; vbId: string }> }) {
  const { id, vbId } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;
  try {
    const body = bodySchema.parse(await readJsonBody(req));
    const booking = await weddingWorkspaceService.replaceVendorBooking(id, vbId, body, session.user.id ?? null);
    return NextResponse.json({ success: true, data: booking }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
