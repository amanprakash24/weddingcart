import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';
import { coupleBudgetService } from '@/services/coupleChecklistBudget.service';

// PATCH / DELETE /api/customer/weddings/[id]/budget/expenses/[expenseId] — change or remove one of the couple's own expenses.
async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string; expenseId: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const p = await params;
    const userId = session.user.id;
    const body = (await req.json().catch(() => null)) ?? {};
    return NextResponse.json({ success: true, data: await asCoupleWedding(p.id, userId, () => coupleBudgetService.updateExpense(p.id, p.expenseId, body), 'money') }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error);
  }
}

async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; expenseId: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const p = await params;
    const userId = session.user.id;
    return NextResponse.json({ success: true, data: await asCoupleWedding(p.id, userId, () => coupleBudgetService.removeExpense(p.id, p.expenseId), 'money') }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error);
  }
}

export const PATCH = platformScoped(handlePATCH);
export const DELETE = platformScoped(handleDELETE);
