import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { hasSuperAdmin } from '@/lib/auth/permissions';
import { handleApiError } from '@/lib/errors';
import { isSourceType } from '@/lib/crm/subject';
import { platformScoped } from '@/lib/ownership/entry';
import { leadDeletionService } from '@/services/leadDeletion.service';

// GET    /api/crm/leads/[sourceType]/[id]/delete — what deleting this lead would remove, and whether it is allowed.
// DELETE /api/crm/leads/[sourceType]/[id]/delete — delete it for good.
//
// The founder (SUPER_ADMIN) only; the service checks that again against the database, and refuses a lead that already has a
// booking, a wedding, an invoice or a reported payment (services/leadDeletion.service.ts).
const noStore = { headers: { 'Cache-Control': 'no-store' } };
type Ctx = { params: Promise<{ sourceType: string; id: string }> };

async function founderId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id && hasSuperAdmin(session.user.roles) ? session.user.id : null;
}

async function handleGET(_req: NextRequest, { params }: Ctx) {
  const actor = await founderId();
  if (!actor) return NextResponse.json({ success: false, error: 'Only the founder can delete a lead' }, { status: 403, ...noStore });
  const { sourceType, id } = await params;
  if (!isSourceType(sourceType)) return NextResponse.json({ success: false, error: 'Invalid sourceType' }, { status: 400, ...noStore });
  try {
    return NextResponse.json({ success: true, data: await leadDeletionService.preview(actor, sourceType, id) }, noStore);
  } catch (err) {
    return handleApiError(err);
  }
}

async function handleDELETE(_req: NextRequest, { params }: Ctx) {
  const actor = await founderId();
  if (!actor) return NextResponse.json({ success: false, error: 'Only the founder can delete a lead' }, { status: 403, ...noStore });
  const { sourceType, id } = await params;
  if (!isSourceType(sourceType)) return NextResponse.json({ success: false, error: 'Invalid sourceType' }, { status: 400, ...noStore });
  try {
    return NextResponse.json({ success: true, data: await leadDeletionService.remove(actor, sourceType, id) }, noStore);
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const DELETE = platformScoped(handleDELETE);
