import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

const bodySchema = z.object({
  brideName: z.string().trim().min(1).optional(),
  bridePhone: z.string().trim().min(1).optional(),
  groomName: z.string().trim().min(1).optional(),
  groomPhone: z.string().trim().min(1).optional(),
  preferredLanguage: z.string().trim().min(1).optional(),
  preferences: z.string().trim().min(1).optional(),
});

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = bodySchema.parse(await req.json());
    const couple = await weddingWorkspaceService.upsertCouple(id, body);
    return NextResponse.json({ success: true, data: couple });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const PATCH = platformScoped(handlePATCH);
