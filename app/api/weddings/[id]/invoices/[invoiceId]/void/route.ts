import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { invoiceWorkflowService } from '@/services/invoiceWorkflow.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

// POST /api/weddings/[id]/invoices/[invoiceId]/void — { reason } (money design v1, PR 7). Cancels an invoice the couple never paid; it
// stays on record, frozen, and counts for nothing. Not the agreement's advance / balance invoice. Full money access on the wedding.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  const { id, invoiceId } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  try {
    const body = ((await req.json().catch(() => null)) ?? {}) as { reason?: unknown };
    const result = await invoiceWorkflowService.voidInvoice(id, invoiceId, { reason: body.reason }, guard.session.user.id ?? null);
    return NextResponse.json({ success: true, data: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
