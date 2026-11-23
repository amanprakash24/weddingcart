import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';
import { coupleVendorsService } from '@/services/coupleVendors.service';

// DELETE /api/customer/weddings/[id]/quote-requests/[requestId]: the couple no longer needs this quote (the request is closed, kept).
async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id, requestId } = await params;
    const userId = session.user.id;
    return NextResponse.json({ success: true, data: await asCoupleWedding(id, userId, () => coupleVendorsService.closeRequest(id, requestId, userId), 'plan') });
  } catch (error) {
    return handleApiError(error);
  }
}

export const DELETE = platformScoped(handleDELETE);
