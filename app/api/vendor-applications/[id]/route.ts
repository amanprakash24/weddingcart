import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import VendorApplicationModel from '@/lib/models/VendorApplication';
import VendorModel from '@/lib/models/Vendor';

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80';

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

async function createVendorFromApplication(app: InstanceType<typeof VendorApplicationModel>) {
  const vendorId = `${app.category}-${slugify(app.businessName)}-${Date.now()}`;

  const features: string[] = [];
  if (app.experience) features.push(`${app.experience} of experience`);
  if (app.instagram) features.push(`Instagram: ${app.instagram}`);
  if (app.website) features.push(`Website: ${app.website}`);

  const vendor = await VendorModel.create({
    id: vendorId,
    name: app.businessName,
    ownerName: app.ownerName,
    ownerPhone: app.ownerPhone,
    ownerEmail: app.ownerEmail,
    category: app.category,
    city: app.city,
    priceMin: app.priceMin || 0,
    priceMax: app.priceMax || 0,
    rating: 0,
    reviewCount: 0,
    image: app.coverImage || DEFAULT_IMAGE,
    images: app.coverImage ? [app.coverImage] : [DEFAULT_IMAGE],
    description: app.description || `${app.businessName} — a verified ShaadiShopping vendor.`,
    features,
    packages: [],
    isFeatured: false,
  });

  return vendor.id as string;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { id } = await params;
    const application = await VendorApplicationModel.findById(id);
    if (!application) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: application });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();

    // Fetch existing record to check previous status
    const existing = await VendorApplicationModel.findById(id);
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    // Auto-create vendor on first approval
    if (body.status === 'approved' && existing.status !== 'approved' && !existing.vendorId) {
      const vendorId = await createVendorFromApplication(existing);
      body.vendorId = vendorId;
    }

    const application = await VendorApplicationModel.findByIdAndUpdate(id, body, { new: true });
    return NextResponse.json({ success: true, data: application });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { id } = await params;
    await VendorApplicationModel.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
