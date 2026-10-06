import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// Cancel this vendor and book another one for the same service, in one step. The new booking waits for their yes; nothing is sent.
const bodySchema = z.object({
  vendorId: z.string().trim().min(1),
  agreedPrice: z.number().int().positive(),
  reason: z.string().trim().max(300).optional(),
});

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; vbId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id, vbId } = await params;
  try {
    const body = bodySchema.parse(await req.json());
    const booking = await weddingWorkspaceService.replaceVendorBooking(id, vbId, body, session.user.id ?? null);
    return NextResponse.json({ success: true, data: booking }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
