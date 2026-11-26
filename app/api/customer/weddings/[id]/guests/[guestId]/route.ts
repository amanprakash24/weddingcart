import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { guestService } from '@/services/guest.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';
import { guestInputSchema } from '@/lib/guest/guestInput';
import { readJsonBody } from '@/lib/readJsonBody';

// The shared guest rules (lib/guest/guestInput.ts): optional details may be null.
const schema = guestInputSchema;

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string; guestId: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = schema.parse(await readJsonBody(req));
    const { id, guestId } = await params;
    const userId = session.user.id;
    const updated = await asCoupleWedding(id, userId, async () => {
      await guestService.listForClient(id, userId);
      return guestService.update(id, guestId, body);
    }, 'plan');
    return NextResponse.json({ success: true, data: updated });
  } catch (error) { return handleApiError(error); }
}

async function handleDELETE(_req: Request, { params }: { params: Promise<{ id: string; guestId: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id, guestId } = await params;
    const userId = session.user.id;
    await asCoupleWedding(id, userId, async () => {
      await guestService.listForClient(id, userId);
      await guestService.remove(id, guestId);
    }, 'plan');
    return NextResponse.json({ success: true });
  } catch (error) { return handleApiError(error); }
}

// Record ownership: entered as Shaadi Shopping (lib/ownership/entry.ts), then run in the business of the couple's own wedding —
// Shaadi Shopping's or a venue's on Vivah OS (lib/customer/coupleEntry.ts).
export const PATCH = platformScoped(handlePATCH);
export const DELETE = platformScoped(handleDELETE);
