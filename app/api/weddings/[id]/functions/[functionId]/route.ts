import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { FUNCTION_TYPES } from '@/lib/wedding/functions';

// Only the fields that are sent change; send null to clear the optional ones.
const patchSchema = z
  .object({
    type: z.enum(FUNCTION_TYPES),
    label: z.string().trim().max(80).nullable(),
    date: z.coerce.date(),
    startTime: z.string().trim().nullable(),
    venueName: z.string().trim().max(160).nullable(),
    venueAddress: z.string().trim().max(300).nullable(),
    city: z.string().trim().max(80),
    budget: z.number().int().min(0).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change' });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; functionId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id, functionId } = await params;
  try {
    const patch = patchSchema.parse(await req.json());
    const updated = await weddingWorkspaceService.updateFunction(id, functionId, patch, session.user.id ?? null);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

// Only an empty function can be deleted (nothing booked, no quoted service waiting, no guest replies, not the last one).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; functionId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id, functionId } = await params;
  try {
    await weddingWorkspaceService.deleteFunction(id, functionId, session.user.id ?? null);
    return NextResponse.json({ success: true, data: { id: functionId } });
  } catch (err) {
    return handleApiError(err);
  }
}
