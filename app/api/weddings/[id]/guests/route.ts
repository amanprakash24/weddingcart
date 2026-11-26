import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { guestService } from '@/services/guest.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { guestInputSchema } from '@/lib/guest/guestInput';
import { readJsonBody } from '@/lib/readJsonBody';

// The shared guest rules (lib/guest/guestInput.ts): optional details may be null.
const guestSchema = guestInputSchema;

async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ success: true, data: await guestService.listForAdmin((await params).id) }); } catch (error) { return handleApiError(error); }
}

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = guestSchema.parse(await readJsonBody(req));
    return NextResponse.json({ success: true, data: await guestService.create((await params).id, body) }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const POST = platformScoped(handlePOST);
