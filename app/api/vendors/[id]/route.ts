import { NextRequest, NextResponse } from 'next/server';
import { vendorService } from '@/services/vendor.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';

// vendorService.getById returns the real Category relation (truthful
// repository/service data) — the admin frontend contract expects a flat
// `category` slug string (the old Mongoose shape), so that shaping happens
// here at the route boundary, not in the repository or service.
function toResponseShape(vendor: NonNullable<Awaited<ReturnType<typeof vendorService.getById>>>) {
  const { category, ...rest } = vendor;
  return { ...rest, category: category?.slug ?? null };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const vendor = await vendorService.getById(id);
    if (!vendor) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    // Draft/pending-verification vendors are admin-only — this is the one
    // gate that protects them everywhere this route is read from: the admin
    // edit form (which needs it), and the public VendorDetailClient/
    // VendorPortfolioClient (which fetch this same route client-side, after
    // the page itself has already rendered, so a page-level check alone
    // isn't enough).
    if (vendor.status !== 'PUBLISHED' && !(await requireAdmin())) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: toResponseShape(vendor) });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vendor' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const {
      name,
      ownerName,
      ownerPhone,
      ownerEmail,
      category: categorySlug,
      city,
      address,
      mapEmbedUrl,
      priceMin,
      priceMax,
      guestCapacity,
      venueType,
      description,
      features,
      isFeatured,
      status,
      virtualTourVideo,
      image,
      images,
      packages,
      faqs,
    } = body;

    await vendorService.update(
      id,
      {
        name,
        ownerName,
        ownerPhone,
        ownerEmail,
        ...(categorySlug !== undefined ? { category: { connect: { slug: categorySlug } } } : {}),
        city,
        address,
        mapEmbedUrl,
        priceMin,
        priceMax,
        guestCapacity,
        venueType,
        description,
        features,
        isFeatured,
        status,
        virtualTourVideo,
        image,
        images,
      },
      { packages, faqs }
    );

    // Re-fetch the fully composed record (packages + flattened category) so
    // the admin form's post-save state matches what GET returns — the
    // transaction's own return value is a plain scalar Vendor row.
    const vendor = await vendorService.getById(id);
    return NextResponse.json({ success: true, data: vendor ? toResponseShape(vendor) : null });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    await vendorService.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
