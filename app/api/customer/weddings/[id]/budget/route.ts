import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';
import { coupleBudgetService } from '@/services/coupleChecklistBudget.service';

// PATCH /api/customer/weddings/[id]/budget — the couple's own total ({ total }) or one category's plan ({ category, planned }; blank
// removes it). The money permission: family members without payments never see or change the budget.
async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const p = await params;
    const userId = session.user.id;
    const body = (await req.json().catch(() => null)) ?? {};
    return NextResponse.json({ success: true, data: await asCoupleWedding(p.id, userId, (): Promise<unknown> => ('category' in body ? coupleBudgetService.setPlanned(p.id, body.category, body.planned) : coupleBudgetService.setTotal(p.id, body.total, userId)), 'money') }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error);
  }
}

export const PATCH = platformScoped(handlePATCH);
