import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { quotationService } from '@/services/quotation.service';
import { updateQuotationSchema } from '../schema';

type Params = { params: Promise<{ id: string }> };

const unauthorized = () => NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await requireRole(ADMIN_ROLES))) return unauthorized();
  try {
    return NextResponse.json({ success: true, data: await quotationService.getById((await params).id) });
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH — edit a DRAFT (409 once it has been sent).
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await requireRole(ADMIN_ROLES))) return unauthorized();
  try {
    const input = updateQuotationSchema.parse(await req.json());
    return NextResponse.json({ success: true, data: await quotationService.update((await params).id, input) });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE — remove a DRAFT (409 for anything that was sent; those are kept as history).
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await requireRole(ADMIN_ROLES))) return unauthorized();
  try {
    await quotationService.deleteDraft((await params).id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
