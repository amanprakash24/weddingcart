import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
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
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
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
