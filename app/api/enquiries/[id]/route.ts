import { NextRequest, NextResponse } from 'next/server';
import { enquiryService } from '@/services/enquiry.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import type { Enquiry, EnquiryStatus } from '@/generated/prisma/client';

function toResponseShape(enquiry: Enquiry) {
  return {
    ...enquiry,
    _id: enquiry.id,
    status: enquiry.status.toLowerCase(),
  };
}

function toEnquiryStatus(status: unknown): EnquiryStatus | undefined {
  if (status === 'new') return 'NEW';
  if (status === 'contacted') return 'CONTACTED';
  if (status === 'closed') return 'CLOSED';
  return undefined;
}

// Hard boundary: PUT only ever accepts `status` (the legacy tri-state
// field). pipelineStage/assignedTo/tasks/activities/wedding are the CRM's
// own fields and are never reachable from this route.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const status = toEnquiryStatus(body.status);
    if (!status) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    const enquiry = await enquiryService.update(id, { status });
    return NextResponse.json({ success: true, data: toResponseShape(enquiry) });
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
    await enquiryService.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
