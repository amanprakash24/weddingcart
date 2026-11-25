import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { quotationUrl } from '@/lib/quotation/proposal';
import { quotationService } from '@/services/quotation.service';
import { platformScoped } from '@/lib/ownership/entry';

const unauthorized = () => NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
const NO_STORE = { 'Cache-Control': 'no-store' };

// POST /api/quotations/[id]/share — CRM "Share on WhatsApp": DRAFT → READY_TO_SHARE and a new client link. NOT "sent": staff
// confirm that with /send. 400 if the quote is not ready (no lines / no future valid-until), 409 if it is not a draft (a second
// click). The URL is returned ONLY in this response; only its hash is stored.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return unauthorized();
  try {
    const { quotation, token } = await quotationService.prepareShare((await params).id, session.user.id ?? null);
    // The host staff are on (production, preview or local), so the link always points at the same site.
    return NextResponse.json({ success: true, data: quotation, url: quotationUrl(req.nextUrl.origin, token) }, { headers: NO_STORE });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/quotations/[id]/share — "Not sent": READY_TO_SHARE → DRAFT, and the link stops working. 409 otherwise.
async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return unauthorized();
  try {
    const quotation = await quotationService.cancelShare((await params).id, session.user.id ?? null);
    return NextResponse.json({ success: true, data: quotation }, { headers: NO_STORE });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
export const DELETE = platformScoped(handleDELETE);
