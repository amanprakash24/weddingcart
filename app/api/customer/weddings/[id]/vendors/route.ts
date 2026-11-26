import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';
import { ownVendorBody } from '@/lib/wedding/coupleVendorSchema';
import { coupleVendorsService } from '@/services/coupleVendors.service';
import { readJsonBody } from '@/lib/readJsonBody';

// POST /api/customer/weddings/[id]/vendors: the couple adds a vendor they found themselves. It is their own record, shown as
// "added by you", never a Shaadi Shopping partner (services/coupleVendors.service.ts).
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = ownVendorBody.parse(await readJsonBody(req));
    const { id } = await params;
    const userId = session.user.id;
    return NextResponse.json({ success: true, data: await asCoupleWedding(id, userId, () => coupleVendorsService.addOwn(id, body, userId), 'plan') }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = platformScoped(handlePOST);
