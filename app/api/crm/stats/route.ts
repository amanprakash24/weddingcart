import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { leadInboxService } from '@/services/leadInbox.service';

export async function GET() {
  if (!(await requireRole(ADMIN_ROLES))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const stats = await leadInboxService.stats();
  return NextResponse.json({ success: true, data: stats });
}
