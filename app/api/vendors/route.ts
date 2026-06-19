import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import VendorModel from '@/lib/models/Vendor';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);

    const category = searchParams.get('category');
    const city = searchParams.get('city');
    const search = searchParams.get('search');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const minRating = searchParams.get('minRating');
    const sort = searchParams.get('sort') || 'rating';
    const featured = searchParams.get('featured');
    const limit = parseInt(searchParams.get('limit') || '50');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};

    if (category) query.category = category;
    if (city) query.city = city;
    if (featured === 'true') query.isFeatured = true;
    if (minRating) query.rating = { $gte: parseFloat(minRating) };
    if (minPrice) query.priceMin = { $gte: parseInt(minPrice) };
    if (maxPrice) query.priceMax = { $lte: parseInt(maxPrice) };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sortQuery: any = { sortOrder: 1, isFeatured: -1, rating: -1, reviewCount: -1 };
    if (sort === 'price-asc') sortQuery = { sortOrder: 1, isFeatured: -1, priceMin: 1 };
    else if (sort === 'price-desc') sortQuery = { sortOrder: 1, isFeatured: -1, priceMin: -1 };
    else if (sort === 'reviews') sortQuery = { sortOrder: 1, isFeatured: -1, reviewCount: -1, rating: -1 };

    const vendors = await VendorModel.find(query).sort(sortQuery).limit(limit).lean();
    return NextResponse.json({ success: true, data: vendors, total: vendors.length });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch vendors' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await connectDB();
    const body = await req.json();
    const vendor = await VendorModel.create(body);
    return NextResponse.json({ success: true, data: vendor }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create vendor' }, { status: 500 });
  }
}
