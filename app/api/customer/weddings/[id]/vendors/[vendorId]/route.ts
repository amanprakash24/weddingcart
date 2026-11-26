import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';
import { ownVendorBody } from '@/lib/wedding/coupleVendorSchema';
import { coupleVendorsService } from '@/services/coupleVendors.service';
import { readJsonBody } from '@/lib/readJsonBody';

// PATCH / DELETE /api/customer/weddings/[id]/vendors/[vendorId]: the couple changes or removes one of their own outside vendors.
type Ctx = { params: Promise<{ id: string; vendorId: string }> };

async function handlePATCH(req: NextRequest, { params }: Ctx) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = ownVendorBody.parse(await readJsonBody(req));
    const { id, vendorId } = await params;
    const userId = session.user.id;
    return NextResponse.json({ success: true, data: await asCoupleWedding(id, userId, () => coupleVendorsService.updateOwn(id, vendorId, body, userId), 'plan') });
  } catch (error) {
    return handleApiError(error);
  }
}

async function handleDELETE(_req: NextRequest, { params }: Ctx) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id, vendorId } = await params;
    const userId = session.user.id;
    return NextResponse.json({ success: true, data: await asCoupleWedding(id, userId, () => coupleVendorsService.removeOwn(id, vendorId, userId), 'plan') });
  } catch (error) {
    return handleApiError(error);
  }
}

export const PATCH = platformScoped(handlePATCH);
export const DELETE = platformScoped(handleDELETE);
