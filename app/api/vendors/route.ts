import { NextRequest, NextResponse } from 'next/server';
import { vendorService } from '@/services/vendor.service';
import { requireAdmin } from '@/lib/adminAuth';
import type { VendorStatus } from '@/generated/prisma/client';

const VALID_STATUSES: VendorStatus[] = ['DRAFT', 'PENDING_VERIFICATION', 'PUBLISHED'];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const category = searchParams.get('category') || undefined;
    const city = searchParams.get('city') || undefined;
    const search = searchParams.get('search') || undefined;
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const minRating = searchParams.get('minRating');
    const sort = (searchParams.get('sort') || 'rating') as
      | 'rating'
      | 'price-asc'
      | 'price-desc'
      | 'reviews';
    const featured = searchParams.get('featured');

    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const skip = (page - 1) * limit;

    // Anonymous callers are always forced to PUBLISHED regardless of what
    // they pass — this is the one gate that makes every public consumer of
    // this endpoint (category/city pages, live plan preview, dashboard,
    // vendor search) show only published vendors, without each of them
    // remembering to filter status themselves. Only an authenticated admin
    // may request a specific status or 'all' (the admin vendor list).
    const isAdmin = await requireAdmin();
    const requestedStatus = searchParams.get('status');
    const status = !isAdmin
      ? 'PUBLISHED'
      : requestedStatus && requestedStatus !== 'all' && VALID_STATUSES.includes(requestedStatus as VendorStatus)
        ? (requestedStatus as VendorStatus)
        : undefined;

    const result = await vendorService.search({
      category,
      city,
      search,
      minPrice: minPrice ? parseInt(minPrice) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
      minRating: minRating ? parseFloat(minRating) : undefined,
      featured: featured === 'true',
      status,
      sort,
      skip,
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
      page,
      limit,
    });
  } catch (err) {
    console.error('GET /api/vendors failed:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vendors' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    // No `slug` here, deliberately — it's always derived server-side from
    // name+city (vendorService.create), never accepted from the client.
    const {
      name,
      ownerName,
      ownerPhone,
      ownerEmail,
      categoryId,
      city,
      address,
      mapEmbedUrl,
      priceMin,
      priceMax,
      guestCapacity,
      venueType,
      image,
      images,
      virtualTourVideo,
      description,
      features,
      isFeatured,
      status,
      faqs,
    } = body;

    const vendor = await vendorService.create({
      name,
      ownerName,
      ownerPhone,
      ownerEmail,
      categoryId,
      city,
      address,
      mapEmbedUrl,
      priceMin,
      priceMax,
      guestCapacity,
      venueType,
      image,
      images,
      virtualTourVideo,
      description,
      features,
      isFeatured,
      status,
    });

    if (Array.isArray(faqs) && faqs.length) {
      await vendorService.update(vendor.id, {}, { faqs });
    }

    return NextResponse.json(
      { success: true, data: vendor },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/vendors failed:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to create vendor' },
      { status: 500 }
    );
  }
}
