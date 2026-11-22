import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { guestService } from '@/services/guest.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { guestInputSchema } from '@/lib/guest/guestInput';

// The shared guest rules (lib/guest/guestInput.ts): optional details may be null.
const schema = guestInputSchema;

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string; guestId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try { const body = schema.parse(await req.json()); const { id, guestId } = await params; return NextResponse.json({ success: true, data: await guestService.update(id, guestId, body) }); } catch (error) { return handleApiError(error); }
}

async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; guestId: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try { const { id, guestId } = await params; await guestService.remove(id, guestId); return NextResponse.json({ success: true }); } catch (error) { return handleApiError(error); }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const PATCH = platformScoped(handlePATCH);
export const DELETE = platformScoped(handleDELETE);
