import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { leadInboxService } from '@/services/leadInbox.service';
import { platformScoped } from '@/lib/ownership/entry';

async function handleGET() {
  if (!(await requireRole(ADMIN_ROLES))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const stats = await leadInboxService.stats();
  return NextResponse.json({ success: true, data: stats });
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
