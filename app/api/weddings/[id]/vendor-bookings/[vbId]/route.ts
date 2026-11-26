import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { moneyAccessFor, moneyDenied } from '@/lib/auth/moneyGuard';
import { canSeeVendorMoney } from '@/lib/auth/moneyAccess';
import { z } from 'zod';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { readJsonBody } from '@/lib/readJsonBody';

// One deliberate scope addition beyond Milestone 6's literal spec (see
// domain-model.md §5.2's "not yet built" note) — no vendor-facing self-serve
// confirm flow exists yet (Vendor OS, a later milestone), so this is how
// Operations records a real confirmation obtained by phone/WhatsApp. It's
// also the only trigger path this milestone has for the automatic
// PLANNING->ACTIVE transition.
//
// Send { status } to record the vendor's answer (confirm / decline / completed), or { agreedPrice } to correct the price.
// Cancelling a vendor is its own call (…/cancel), because it also puts the service back on the "needs a vendor" list.
const bodySchema = z
  .object({
    status: z.enum(['PENDING_VENDOR_CONFIRMATION', 'CONFIRMED', 'DECLINED', 'CUSTOMER_APPROVAL_PENDING', 'CANCELLED', 'COMPLETED']),
    declineReason: z.string().trim().min(1).optional(),
    // Sprint 7.3 — captured only when status is COMPLETED.
    onTimeService: z.boolean().optional(),
    agreedPrice: z.number().int().positive(),
  })
  .partial()
  .refine((v) => v.status !== undefined || v.agreedPrice !== undefined, { message: 'Send a status or an agreed price' })
  .refine((v) => v.status === undefined || v.agreedPrice === undefined, { message: 'Change the status or the price, not both at once' });

// Who may do what (lib/auth/moneyAccess.ts):
//  • re-pricing or cancelling a vendor changes the wedding's vendor money → the coordinator or the founder;
//  • recording the vendor's answer (confirmed / declined / completed …) is everyday coordination → anyone on the team. The
//    vendor's price is left out of the reply for anyone who may not see it.
async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string; vbId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { id, vbId } = await params;
  try {
    const { status, declineReason, onTimeService, agreedPrice } = bodySchema.parse(await readJsonBody(req));
    const changesMoney = agreedPrice !== undefined || status === 'CANCELLED';
    if (changesMoney) {
      const denied = await moneyDenied({ wedding: id }, 'full');
      if (denied) return denied;
    }
    if (agreedPrice !== undefined) {
      const updated = await weddingWorkspaceService.updateVendorBookingPrice(id, vbId, agreedPrice, session.user.id ?? null);
      return NextResponse.json({ success: true, data: updated });
    }
    const vendorBooking = await weddingWorkspaceService.updateVendorBookingStatus(id, vbId, status as NonNullable<typeof status>, declineReason, onTimeService);
    const access = changesMoney ? 'full' : await moneyAccessFor(session, { wedding: id });
    const data = canSeeVendorMoney(access) ? vendorBooking : { ...vendorBooking, agreedPrice: null };
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const PATCH = platformScoped(handlePATCH);
