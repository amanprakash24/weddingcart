import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { founderDashboardService } from '@/services/founderDashboard.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

async function handleGET(req: NextRequest) {
  if (!(await requireRole(ADMIN_ROLES))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get('date');
  const date = dateParam ? new Date(dateParam) : new Date();

  try {
    const dashboard = await founderDashboardService.getDashboard(date);
    return NextResponse.json({ success: true, data: dashboard });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
