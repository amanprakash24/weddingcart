import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';

// One deliberate scope addition beyond Milestone 6's literal spec (see
// domain-model.md §5.2's "not yet built" note) — no vendor-facing self-serve
// confirm flow exists yet (Vendor OS, a later milestone), so this is how
// Operations records a real confirmation obtained by phone/WhatsApp. It's
// also the only trigger path this milestone has for the automatic
// PLANNING->ACTIVE transition.
const bodySchema = z.object({
  status: z.enum(['PENDING_VENDOR_CONFIRMATION', 'CONFIRMED', 'DECLINED', 'CUSTOMER_APPROVAL_PENDING', 'CANCELLED', 'COMPLETED']),
  declineReason: z.string().trim().min(1).optional(),
  // Sprint 7.3 — captured only when status is COMPLETED.
  onTimeService: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; vbId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id, vbId } = await params;
  try {
    const { status, declineReason, onTimeService } = bodySchema.parse(await req.json());
    const vendorBooking = await weddingWorkspaceService.updateVendorBookingStatus(id, vbId, status, declineReason, onTimeService);
    return NextResponse.json({ success: true, data: vendorBooking });
  } catch (err) {
    return handleApiError(err);
  }
}
