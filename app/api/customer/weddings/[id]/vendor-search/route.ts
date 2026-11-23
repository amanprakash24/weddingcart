import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';
import { coupleVendorsService } from '@/services/coupleVendors.service';

// GET /api/customer/weddings/[id]/vendor-search?category=<slug>: vendors listed on Shaadi Shopping for the couple's wedding, its city
// first. Listing facts only, never the owner's contact details. Without `category`: the categories that have listed vendors.
async function handleGET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const userId = session.user.id;
    const category = req.nextUrl.searchParams.get('category')?.trim().slice(0, 60) ?? '';
    const data = category
      ? await asCoupleWedding(id, userId, () => coupleVendorsService.searchListed(id, category))
      : await asCoupleWedding(id, userId, () => coupleVendorsService.categories());
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = platformScoped(handleGET);
