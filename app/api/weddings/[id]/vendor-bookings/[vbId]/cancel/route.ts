import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// The wedding team drops this vendor. The service goes back to "needs a vendor". Nothing is sent to the vendor.
const bodySchema = z.object({ reason: z.string().trim().max(300).default('') });

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; vbId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id, vbId } = await params;
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
