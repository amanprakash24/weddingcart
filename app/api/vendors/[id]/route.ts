import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { vendorService } from '@/services/vendor.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// /vendors/[id] is ISR (revalidate = 3600) and prerendered at build. When a vendor is unpublished, the
// hourly refresh ends in notFound() and the old page kept being served until the next deploy
// (seen 2026-09-28). Marking the page stale on every admin write makes the next visit re-render it —
// PUBLISHED → normal page, anything else → 404 + noindex — without a deploy. The public URL is the slug,
// not this route's UUID. Best-effort: a cache failure must never turn a saved change into an error.
function revalidateVendorPage(slug: string | null | undefined) {
  if (!slug) return;
  try {
    revalidatePath(`/vendors/${slug}`);
  } catch (err) {
    console.error(`revalidatePath(/vendors/${slug}) failed:`, err);
  }
}

// vendorService.getById returns the real Category relation (truthful
// repository/service data) — the admin frontend contract expects a flat
// `category` slug string (the old Mongoose shape), so that shaping happens
// here at the route boundary, not in the repository or service.
function toResponseShape(vendor: NonNullable<Awaited<ReturnType<typeof vendorService.getById>>>) {
  const { category, ...rest } = vendor;
  return { ...rest, category: category?.slug ?? null };
}

async function handleGET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  } catch (err) {
    console.error('GET /api/vendors/[id] failed:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vendor' },
      { status: 500 }
    );
  }
}

async function handlePUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      area,
      mapEmbedUrl,
      priceMin,
      priceMax,
      priceUnit,
      guestCapacity,
      venueType,
      defaultTerms,
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
        area,
        mapEmbedUrl,
        priceMin,
        priceMax,
        priceUnit,
        guestCapacity,
        venueType,
        ...(typeof defaultTerms === 'string' ? { defaultTerms: defaultTerms.trim() || null } : {}),
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
    revalidateVendorPage(vendor?.slug);
    return NextResponse.json({ success: true, data: vendor ? toResponseShape(vendor) : null });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handleDELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    // Read the slug first — after the delete there is nothing left to look it up from.
    const existing = await vendorService.getById(id);
    await vendorService.delete(id);
    revalidateVendorPage(existing?.slug);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const PUT = platformScoped(handlePUT);
export const DELETE = platformScoped(handleDELETE);
