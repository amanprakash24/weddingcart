import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueOfferingService } from '@/services/venueOffering.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// POST /api/vendor-os/offerings/from-listing — { packageId }: copy a package from the business's OWN public Shaadi Shopping page
// into its price list, once. Answers with the whole catalog. Another listing's package is simply not found.
async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.packageId !== 'string' || !body.packageId) return NextResponse.json({ success: false, error: 'Choose the package to copy' }, { status: 400 });
    await venueOfferingService.copyListingPackage(body.packageId);
    return NextResponse.json({ success: true, data: await venueOfferingService.catalog() }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST, 'catalog');
