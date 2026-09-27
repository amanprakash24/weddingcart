import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { consultationVendorSelectionService } from '@/services/consultationVendorSelection.service';

const selectionSchema = z.object({
  serviceKey: z.string().trim().min(1).max(100),
  categoryId: z.string().trim().min(1).optional(),
  vendorId: z.string().trim().min(1),
});

const serviceKeySchema = z.object({
  serviceKey: z.string().trim().min(1).max(100),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  if (!(await requireRole(ADMIN_ROLES))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    return NextResponse.json({ success: true, data: await consultationVendorSelectionService.list(id) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  if (!(await requireRole(ADMIN_ROLES))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const input = selectionSchema.parse(await req.json());
    const selection = await consultationVendorSelectionService.select({ consultationId: id, ...input });
    return NextResponse.json({ success: true, data: selection });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  if (!(await requireRole(ADMIN_ROLES))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const { serviceKey } = serviceKeySchema.parse(await req.json());
    await consultationVendorSelectionService.remove(id, serviceKey);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
