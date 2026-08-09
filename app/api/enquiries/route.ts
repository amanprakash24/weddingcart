import { NextRequest, NextResponse } from 'next/server';
import { enquiryService } from '@/services/enquiry.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import type { Enquiry, EnquiryStatus } from '@/generated/prisma/client';

// Admin UI still expects the legacy Mongo shape: lowercase status
// ('new'/'contacted'/'closed', Prisma's EnquiryStatus enum is uppercase) and
// an `_id` field (Prisma's is `id`). Shaping happens here at the route
// boundary, not in the repository/service.
function toResponseShape(enquiry: Enquiry) {
  return {
    ...enquiry,
    _id: enquiry.id,
    status: enquiry.status.toLowerCase(),
  };
}

function toEnquiryStatus(status: string | null): EnquiryStatus | undefined {
  if (status === 'new') return 'NEW';
  if (status === 'contacted') return 'CONTACTED';
  if (status === 'closed') return 'CLOSED';
  return undefined;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = toEnquiryStatus(searchParams.get('status'));

    const { data } = await enquiryService.list({ status });

    return NextResponse.json({ success: true, data: data.map(toResponseShape) });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch enquiries' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vendorId, vendorName, vendorCategory, name, phone, email, city, eventDate, guestCount, eventType, message } = body;

    const enquiry = await enquiryService.create({
      vendorId,
      vendorName,
      vendorCategory,
      name,
      phone,
      email,
      city,
      eventDate,
      guestCount,
      eventType,
      message,
    });

    return NextResponse.json({ success: true, data: toResponseShape(enquiry) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
