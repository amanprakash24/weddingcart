import { NextRequest, NextResponse } from 'next/server';
import { consultationService } from '@/services/consultation.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import type { Consultation, ConsultationStatus } from '@/generated/prisma/client';

function toResponseShape(consultation: Consultation) {
  return {
    ...consultation,
    _id: consultation.id,
    status: consultation.status.toLowerCase(),
  };
}

function toConsultationStatus(status: unknown): ConsultationStatus | undefined {
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
    const status = toConsultationStatus(body.status);
    if (!status) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    const consultation = await consultationService.update(id, { status });
    return NextResponse.json({ success: true, data: toResponseShape(consultation) });
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
    await consultationService.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
