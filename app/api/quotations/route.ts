import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { isSourceType } from '@/lib/crm/subject';
import { quotationService } from '@/services/quotation.service';
import { createQuotationSchema } from './schema';

// Staff-only in V1 (docs/wedding-os/08-quotation.md §10): quotations carry pricing, so there is
// no public route and no customer login/link at this stage.

// GET /api/quotations?sourceType=ENQUIRY&sourceId=<id> — quotations for one lead/enquiry/consultation.
export async function GET(req: NextRequest) {
  if (!(await requireRole(ADMIN_ROLES))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const sourceType = searchParams.get('sourceType') ?? '';
  const sourceId = searchParams.get('sourceId') ?? '';
  if (!isSourceType(sourceType) || !sourceId) {
    return NextResponse.json({ success: false, error: 'sourceType and sourceId are required' }, { status: 400 });
  }
  try {
    return NextResponse.json({ success: true, data: await quotationService.listForSource(sourceType, sourceId) });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/quotations — create a DRAFT for a source.
export async function POST(req: NextRequest) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { sourceType, sourceId, ...input } = createQuotationSchema.parse(await req.json());
    const created = await quotationService.create(sourceType, sourceId, input, session.user.id ?? null);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
