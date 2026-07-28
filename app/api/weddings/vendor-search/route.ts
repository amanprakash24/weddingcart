import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';

// Not nested under /api/weddings/[id] — the picker searches the whole vendor
// catalog, not anything scoped to one wedding.
export async function GET(req: NextRequest) {
  if (!(await requireRole(ADMIN_ROLES))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  const data = await weddingWorkspaceService.searchVendors(q);
  return NextResponse.json({ success: true, data });
}
