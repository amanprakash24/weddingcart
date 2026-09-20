import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { quotationService } from '@/services/quotation.service';
import { rejectQuotationSchema } from '../../schema';

// POST /api/quotations/[id]/reject — the customer declined; a reason is required. 409 unless SENT.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const input = rejectQuotationSchema.parse(await req.json());
    const rejected = await quotationService.reject((await params).id, input, session.user.id ?? null);
    return NextResponse.json({ success: true, data: rejected });
  } catch (err) {
    return handleApiError(err);
  }
}
