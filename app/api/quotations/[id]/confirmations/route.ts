import { NextRequest, NextResponse } from 'next/server';
import { moneyDenied } from '@/lib/auth/moneyGuard';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { confirmationService } from '@/services/confirmation.service';
import { platformScoped } from '@/lib/ownership/entry';

// GET  /api/quotations/[id]/confirmations — the services confirmed so far, each with its own Money card (read).
// POST /api/quotations/[id]/confirmations — { itemIds, channel }: confirm the chosen services of a sent quotation (money design v1,
//      PR 8a). Creates the confirmation (CNF-…), its agreement and its advance invoice in one go. Full money access on the quotation.
async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await moneyDenied({ quotation: id }, 'read');
  if (denied) return denied;
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ success: true, data: await confirmationService.forQuotation(id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await moneyDenied({ quotation: id }, 'full');
  if (denied) return denied;
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = ((await req.json().catch(() => null)) ?? {}) as { itemIds?: unknown; channel?: unknown };
    const result = await confirmationService.confirm(id, { itemIds: body.itemIds, channel: body.channel }, session.user.id ?? null);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const POST = platformScoped(handlePOST);
