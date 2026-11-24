import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { coupleBudgetService, coupleChecklistService } from '@/services/coupleChecklistBudget.service';

// GET /api/weddings/[id]/couple-plan — staff, read-only: the couple's checklist and their own budget records (25 Nov 2026).
async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const [checklist, budget] = await Promise.all([coupleChecklistService.forStaff(id), coupleBudgetService.records(id)]);
    return NextResponse.json({ success: true, data: { checklist, budget } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = platformScoped(handleGET);
