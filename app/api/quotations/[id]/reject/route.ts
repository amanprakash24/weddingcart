import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { quotationService } from '@/services/quotation.service';
import { rejectQuotationSchema } from '../../schema';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/quotations/[id]/reject — the customer declined; a reason is required. 409 unless SENT.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
