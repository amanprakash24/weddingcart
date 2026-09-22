import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { vendorApplicationService } from '@/services/vendorApplication.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';
import { INDIAN_MOBILE_ERROR, normalizeIndianMobile } from '@/lib/indianPhone';
import type { VendorApplicationWithCategory } from '@/repositories/vendorApplication.repository';
import type { ApplicationStatus } from '@/generated/prisma/client';

// Public, unauthenticated POST with previously zero rate limiting or
// validation (audit finding) — reuses the exact throttle mechanism and
// namespacing convention already shipped for /api/consultations and
// /api/events/[id]/orders rather than inventing a new one.
const RATE_LIMIT_PREFIX = 'vendor-application:';

function clientIp(req: NextRequest): string {
  // Vercel sets x-forwarded-for; first entry is the original client.
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

// ownerPhone reuses the /^\d{10}$/ convention already established at
// app/api/otp/send/route.ts. `category` is the exact field name the live
// frontend (components/VendorOnboardingClient.tsx) submits — it holds a
// Category id (the underlying DB column is named categoryId; see
// prisma/schema.prisma's VendorApplication model), validated here for
// non-emptiness only — the existing category-existence check
// (NotFoundError, vendorApplicationService.create()) is untouched.
// ownerEmail is optional/blank-tolerant, matching the guests-route and
// event-order conventions, even though the live form currently marks it
// required client-side — this only widens what a direct API caller may
// send, it doesn't change the form's behavior. portfolioImages/
// foodMenuImages are capped well above the live form's own usage (3 and 2
// respectively) as a bound on unbounded input, not a hard-coded exact
// count — nothing here asks for that as a business rule.
const schema = z.object({
  businessName: z.string().trim().min(1),
  ownerName: z.string().trim().min(1),
  // Accepts the way people actually write a number ("+91 98765 43210",
  // "98765-43210", "09876543210") and normalizes to the bare 10 digits that
  // /api/otp/send and the vendor's OTP login use. Anything that still isn't an
  // Indian mobile number after normalizing is rejected with a field-level message.
  ownerPhone: z
    .string()
    .transform((value) => normalizeIndianMobile(value) ?? value.trim())
    .refine((value) => /^[6-9]\d{9}$/.test(value), { message: INDIAN_MOBILE_ERROR }),
  ownerEmail: z.string().trim().email().optional().or(z.literal('')),
  category: z.string().trim().min(1),
  city: z.string().trim().min(1),
  priceMin: z.coerce.number().int().min(0).optional(),
  priceMax: z.coerce.number().int().min(0).optional(),
  experience: z.string().trim().optional(),
  description: z.string().trim().optional(),
  instagram: z.string().trim().optional(),
  website: z.string().trim().optional(),
  coverImage: z.string().trim().url().optional().or(z.literal('')),
  portfolioImages: z.array(z.string().trim().url()).max(10).optional(),
  foodMenuImages: z.array(z.string().trim().url()).max(5).optional(),
});

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
  } catch (err) {
    console.error('GET /api/vendor-applications failed:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch applications' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitId = `${RATE_LIMIT_PREFIX}${clientIp(req)}`;
    if (await isRequestRateLimited(rateLimitId)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }
    await recordRequest(rateLimitId);

    const body = await req.json();
    // Whitelist + shape-validate fields — prevents injecting status or
    // vendorId (same whitelist intent as before) and now also rejects a
    // malformed payload before it ever reaches the service/database.
    const parsed = schema.parse(body);

    const application = await vendorApplicationService.create({
      businessName: parsed.businessName,
      ownerName: parsed.ownerName,
      ownerPhone: parsed.ownerPhone,
      ownerEmail: parsed.ownerEmail ?? '',
      category: parsed.category,
      city: parsed.city,
      priceMin: parsed.priceMin,
      priceMax: parsed.priceMax,
      experience: parsed.experience,
      description: parsed.description,
      instagram: parsed.instagram,
      website: parsed.website,
      coverImage: parsed.coverImage,
      portfolioImages: parsed.portfolioImages,
      foodMenuImages: parsed.foodMenuImages,
    });

    return NextResponse.json({ success: true, data: toResponseShape(application) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
