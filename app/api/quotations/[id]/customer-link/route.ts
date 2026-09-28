import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { proposalUrl } from '@/lib/quotation/proposal';
import { quotationService } from '@/services/quotation.service';

const unauthorized = () => NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
const NO_STORE = { 'Cache-Control': 'no-store' };

// POST /api/quotations/[id]/customer-link — create a NEW proposal link for a sent, still-valid quotation. Any previous
// link stops working. The URL is returned ONLY in this response; it is never stored and cannot be fetched again.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return unauthorized();
  try {
    const { token } = await quotationService.issueCustomerLink((await params).id, session.user.id ?? null);
    // The host staff are on (production, preview or local), so the link always points at the same site.
    return NextResponse.json({ success: true, data: { url: proposalUrl(req.nextUrl.origin, token) } }, { headers: NO_STORE });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/quotations/[id]/customer-link — stop the current link working.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return unauthorized();
  try {
    await quotationService.revokeCustomerLink((await params).id, session.user.id ?? null);
    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (err) {
    return handleApiError(err);
  }
}
