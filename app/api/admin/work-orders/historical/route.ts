import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { canSeeCompanyFinancials } from '@/lib/auth/financialAccess';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { vendorWorkOrderService } from '@/services/vendorWorkOrder.service';

// Work orders for assignments confirmed before work orders existed (money design v1, PR 5, 25 Nov 2026). Founder only.
// GET: the preview — read-only, nothing is written. POST { rows: [{ vendorBookingId, expectedPayable }] }: issue exactly the ticked rows,
// all or none, each only at the amount shown in the preview.
async function founder() {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return { refused: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  if (!canSeeCompanyFinancials(session.user.roles)) return { refused: NextResponse.json({ success: false, error: 'Only the founder can issue work orders for earlier confirmations' }, { status: 403 }) };
  return { session };
}

async function handleGET() {
  const f = await founder();
  if ('refused' in f) return f.refused;
  try {
    return NextResponse.json({ success: true, data: await vendorWorkOrderService.historicalPreview() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePOST(req: NextRequest) {
  const f = await founder();
  if ('refused' in f) return f.refused;
  try {
    const raw: unknown = await req.json().catch(() => null);
    const rows = raw && typeof raw === 'object' && Array.isArray((raw as { rows?: unknown }).rows) ? (raw as { rows: { vendorBookingId: string; expectedPayable: number }[] }).rows : [];
    const data = await vendorWorkOrderService.issueHistorical(rows, f.session.user.id ?? null);
    return NextResponse.json({ success: true, data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const POST = platformScoped(handlePOST);
