import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { isSourceType } from '@/lib/crm/subject';
import { platformScoped } from '@/lib/ownership/entry';
import { platformHandoffService } from '@/services/platformHandoff.service';

// GET  /api/crm/leads/[sourceType]/[id]/send-to-venue — the venues on Vivah OS this enquiry can be sent to.
// POST /api/crm/leads/[sourceType]/[id]/send-to-venue — { vendorId }: send this Shaadi Shopping enquiry into that venue's own
//      Vivah OS Enquiries, linked to this record for commission (services/platformHandoff.service.ts). Shaadi Shopping's team only.
const noStore = { 'Cache-Control': 'no-store' };
type Ctx = { params: Promise<{ sourceType: string; id: string }> };

async function handleGET(_req: NextRequest, { params }: Ctx) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { sourceType } = await params;
  if (!isSourceType(sourceType)) return NextResponse.json({ success: false, error: 'Invalid sourceType' }, { status: 400 });
  try {
    return NextResponse.json({ success: true, data: await platformHandoffService.venues() }, { headers: noStore });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePOST(req: NextRequest, { params }: Ctx) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { sourceType, id } = await params;
  if (!isSourceType(sourceType)) return NextResponse.json({ success: false, error: 'Invalid sourceType' }, { status: 400 });
  try {
    const body = await req.json().catch(() => ({}));
    const vendorId = typeof body?.vendorId === 'string' ? body.vendorId.trim() : '';
    if (!vendorId) return NextResponse.json({ success: false, error: 'Choose a venue' }, { status: 400 });
    const data = await platformHandoffService.send({ sourceType, sourceId: id, vendorId, actorId: session.user.id ?? null });
    return NextResponse.json({ success: true, data }, { headers: noStore });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts); only the hand-over itself runs as the venue.
export const GET = platformScoped(handleGET);
export const POST = platformScoped(handlePOST);
