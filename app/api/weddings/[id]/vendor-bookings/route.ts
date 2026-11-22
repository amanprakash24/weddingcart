import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { z } from 'zod';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

const bodySchema = z.object({
  weddingEventId: z.string().trim().min(1),
  vendorId: z.string().trim().min(1),
  agreedPrice: z.number().int().positive(),
  resolvesTaskId: z.string().trim().min(1).optional(),
});

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;
  try {
    const body = bodySchema.parse(await req.json());
    const vendorBooking = await weddingWorkspaceService.addVendorBooking(id, body, session.user.id ?? null);
    return NextResponse.json({ success: true, data: vendorBooking }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
