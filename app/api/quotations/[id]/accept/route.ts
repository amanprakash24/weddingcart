import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { quotationService } from '@/services/quotation.service';
import { acceptQuotationSchema } from '../../schema';

// POST /api/quotations/[id]/accept — staff record that the customer accepted (WhatsApp / phone / in
// person / other). V1 has no customer login or accept link. 409 unless it is SENT and still valid.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const input = acceptQuotationSchema.parse(await req.json());
    const accepted = await quotationService.accept((await params).id, input, session.user.id ?? null);
    return NextResponse.json({ success: true, data: accepted });
  } catch (err) {
    return handleApiError(err);
  }
}
