import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import VendorModel from '@/lib/models/Vendor';

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
    if (minPrice || maxPrice) {
      query.priceMin = {};
      if (minPrice) query.priceMin.$gte = parseInt(minPrice);
      if (maxPrice) query.priceMin.$lte = parseInt(maxPrice);
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sortQuery: any = { rating: -1 };
    if (sort === 'price-asc') sortQuery = { priceMin: 1 };
    else if (sort === 'price-desc') sortQuery = { priceMin: -1 };
    else if (sort === 'reviews') sortQuery = { reviewCount: -1 };

    const vendors = await VendorModel.find(query).sort(sortQuery).limit(limit).lean();
    return NextResponse.json({ success: true, data: vendors, total: vendors.length });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const vendor = await VendorModel.create(body);
    return NextResponse.json({ success: true, data: vendor }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
