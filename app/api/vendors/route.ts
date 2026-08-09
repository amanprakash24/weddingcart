import { NextRequest, NextResponse } from 'next/server';
import { vendorService } from '@/services/vendor.service';
import { requireAdmin } from '@/lib/adminAuth';

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

    const result = await vendorService.search({
      category,
      city,
      search,
      minPrice: minPrice ? parseInt(minPrice) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
      minRating: minRating ? parseFloat(minRating) : undefined,
      featured: featured === 'true',
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
  } catch {
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
    const vendor = await vendorService.create(body);

    return NextResponse.json(
      { success: true, data: vendor },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to create vendor' },
      { status: 500 }
    );
  }
}
