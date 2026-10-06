import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { quotationService } from '@/services/quotation.service';
import { afterVendorLinkChange, sourceOfQuotation } from '@/lib/vendorEnquiry/hook';
import { updateQuotationSchema } from '../schema';
import { platformScoped } from '@/lib/ownership/entry';

type Params = { params: Promise<{ id: string }> };

const unauthorized = () => NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

async function handleGET(_req: NextRequest, { params }: Params) {
  if (!(await requireRole(ADMIN_ROLES))) return unauthorized();
  try {
    return NextResponse.json({ success: true, data: await quotationService.getById((await params).id) });
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH — edit a DRAFT (409 once it has been sent).
async function handlePATCH(req: NextRequest, { params }: Params) {
  if (!(await requireRole(ADMIN_ROLES))) return unauthorized();
  try {
    const input = updateQuotationSchema.parse(await req.json());
    const updated = await quotationService.update((await params).id, input);
    // Vendors linked on the quote are asked for availability (04-vendor-os.md §9) — best-effort, never fails the save.
    const source = sourceOfQuotation(updated);
    if (source) await afterVendorLinkChange(source.sourceType, source.sourceId, null);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE — remove a DRAFT (409 for anything that was sent; those are kept as history).
async function handleDELETE(_req: NextRequest, { params }: Params) {
  if (!(await requireRole(ADMIN_ROLES))) return unauthorized();
  try {
    const id = (await params).id;
    // Read first: after the delete, the draft (and so its customer record) is gone.
    let draft: Awaited<ReturnType<typeof quotationService.getById>> | null = null;
    try {
      draft = await quotationService.getById(id);
    } catch {
      draft = null; // not found here → deleteDraft below reports it properly
    }
    await quotationService.deleteDraft(id);
    // A discarded draft may drop vendors (or bring back the predecessor's) — the enquiries follow. Best-effort.
    const source = draft ? sourceOfQuotation(draft) : null;
    if (source) await afterVendorLinkChange(source.sourceType, source.sourceId, null);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const PATCH = platformScoped(handlePATCH);
export const DELETE = platformScoped(handleDELETE);
