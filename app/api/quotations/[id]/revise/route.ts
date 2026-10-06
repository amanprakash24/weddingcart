import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { quotationService } from '@/services/quotation.service';
import { afterVendorLinkChange, sourceOfQuotation } from '@/lib/vendorEnquiry/hook';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/quotations/[id]/revise — copy a sent / rejected / expired quotation into a new DRAFT
// (revision + 1). The original is kept as history; 409 if it cannot be revised (e.g. already accepted).
async function handlePOST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const revision = await quotationService.revise((await params).id, session.user.id ?? null);
    // Vendors linked on the quote are asked for availability (04-vendor-os.md §9) — best-effort, never fails the save.
    const source = sourceOfQuotation(revision);
    if (source) await afterVendorLinkChange(source.sourceType, source.sourceId, session.user.id ?? null);
    return NextResponse.json({ success: true, data: revision }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
