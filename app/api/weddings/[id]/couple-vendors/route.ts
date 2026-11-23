import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { coupleVendorsService } from '@/services/coupleVendors.service';

// GET /api/weddings/[id]/couple-vendors: what the couple did on My Wedding about vendors: the outside vendors they hired themselves
// (not partners) and the quotes they asked Shaadi Shopping for.
async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ success: true, data: await coupleVendorsService.forStaff((await params).id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = platformScoped(handleGET);
