import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { moneyAccessFor } from '@/lib/auth/moneyGuard';
import { canSeeVendorMoney } from '@/lib/auth/moneyAccess';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { readJsonBody } from '@/lib/readJsonBody';

// PATCH /api/weddings/[id]/vendor-bookings/[vbId]/details — what a service is (PR A, 26 Nov 2026): its function, day, category and
// description. Everyday coordination, so anyone on the team (like recording the vendor's answer). Never the price: that is
// "Edit price" before a work order, and an adjustment after one.
const text = (max: number) => z.string().trim().max(max).nullable().transform((v) => (v ? v : null));
const bodySchema = z.object({
  weddingEventId: z.string().trim().min(1, 'Pick a function'),
  serviceDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date').nullable(),
  serviceCategory: text(60),
  description: text(200),
});

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string; vbId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { id, vbId } = await params;
  try {
    const input = bodySchema.parse(await readJsonBody(req));
    const updated = await weddingWorkspaceService.updateVendorBookingDetails(id, vbId, input, session.user.id ?? null);
    const access = await moneyAccessFor(session, { wedding: id });
    const data = canSeeVendorMoney(access) ? updated : { ...updated, agreedPrice: null, quotedPrice: null, discountShare: null, vendorPrice: null };
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const PATCH = platformScoped(handlePATCH);
