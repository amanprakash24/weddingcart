import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';
import { coupleBudgetService } from '@/services/coupleChecklistBudget.service';

// POST /api/customer/weddings/[id]/budget/expenses — the couple adds one of their own expenses (never an invoice or payment of ours).
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const p = await params;
    const userId = session.user.id;
    const body = (await req.json().catch(() => null)) ?? {};
    return NextResponse.json({ success: true, data: await asCoupleWedding(p.id, userId, () => coupleBudgetService.addExpense(p.id, body, userId), 'money') }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = platformScoped(handlePOST);
