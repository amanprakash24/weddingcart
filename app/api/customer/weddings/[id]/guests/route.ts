import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { guestService } from '@/services/guest.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';
import { can, guestForViewer } from '@/lib/customer/familyAccess';
import { guestInputSchema } from '@/lib/guest/guestInput';
import { readJsonBody } from '@/lib/readJsonBody';

// The shared guest rules (lib/guest/guestInput.ts): optional details may be null.
const schema = guestInputSchema;

async function handleGET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const userId = session.user.id;
    return NextResponse.json({ success: true, data: await asCoupleWedding(id, userId, async (who) => { const guests = await guestService.listForClient(id, userId); return can(who.role, 'plan') ? guests : guests.map(guestForViewer); }, 'view') });
  } catch (error) { return handleApiError(error); }
}

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = schema.parse(await readJsonBody(req));
    const { id } = await params;
    const userId = session.user.id;
    const created = await asCoupleWedding(id, userId, async () => {
      await guestService.listForClient(id, userId);
      return guestService.create(id, body);
    }, 'plan');
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}

// Record ownership: entered as Shaadi Shopping (lib/ownership/entry.ts), then run in the business of the couple's own wedding —
// Shaadi Shopping's or a venue's on Vivah OS (lib/customer/coupleEntry.ts).
export const GET = platformScoped(handleGET);
export const POST = platformScoped(handlePOST);
