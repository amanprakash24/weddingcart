import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { FUNCTION_TYPES } from '@/lib/wedding/functions';

// Add a function (Mehndi, Sangeet, Reception, …) to the wedding. An "Other" function must be named; the city defaults to the wedding's.
const bodySchema = z.object({
  type: z.enum(FUNCTION_TYPES),
  label: z.string().trim().max(80).nullish(),
  date: z.coerce.date(),
  startTime: z.string().trim().nullish(),
  venueName: z.string().trim().max(160).nullish(),
  venueAddress: z.string().trim().max(300).nullish(),
  city: z.string().trim().max(80).nullish(),
  budget: z.number().int().min(0).nullish(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = bodySchema.parse(await req.json());
    const created = await weddingWorkspaceService.addFunction(id, body, session.user.id ?? null);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
