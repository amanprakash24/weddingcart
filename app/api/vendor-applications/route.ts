import { NextRequest, NextResponse } from 'next/server';
import { vendorApplicationService } from '@/services/vendorApplication.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import type { VendorApplicationWithCategory } from '@/repositories/vendorApplication.repository';
import type { ApplicationStatus } from '@/generated/prisma/client';

// Admin UI still expects the legacy Mongo shape: lowercase status
// ('new'/'approved'/'rejected', Prisma's ApplicationStatus enum is
// uppercase), an `_id` field (Prisma's is `id`), and a flat `category`
// string (Prisma's is a relation) — the admin display renders `{a.category}`
// directly with `capitalize` styling, so it's flattened to the category's
// name here rather than its slug. Shaping happens at the route boundary,
// not in the repository/service.
function toResponseShape(app: VendorApplicationWithCategory) {
  const { category, ...rest } = app;
  return { ...rest, _id: app.id, category: category.name, status: app.status.toLowerCase() };
}

function toApplicationStatus(status: string | null): ApplicationStatus | undefined {
  if (status === 'new') return 'NEW';
  if (status === 'approved') return 'APPROVED';
  if (status === 'rejected') return 'REJECTED';
  return undefined;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');
    const status = statusParam && statusParam !== 'all' ? toApplicationStatus(statusParam) : undefined;

    const { data } = await vendorApplicationService.list({ status });
    return NextResponse.json({ success: true, data: data.map(toResponseShape) });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch applications' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Whitelist fields — prevent injecting status or vendorId
    const {
      businessName, ownerName, ownerPhone, ownerEmail,
      category, city, priceMin, priceMax,
      experience, description, instagram, website,
      coverImage, portfolioImages, foodMenuImages,
    } = body;

    const application = await vendorApplicationService.create({
      businessName, ownerName, ownerPhone, ownerEmail,
      category, city, priceMin, priceMax,
      experience, description, instagram, website,
      coverImage, portfolioImages, foodMenuImages,
    });

    return NextResponse.json({ success: true, data: toResponseShape(application) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
