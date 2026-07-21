import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';

// Powers the "Sales Person" filter dropdown (components/crm/LeadFilters.tsx) —
// anyone holding an admin-class role can be assigned a lead.
export async function GET() {
  if (!(await requireRole(ADMIN_ROLES))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const reps = await prisma.user.findMany({
    where: { roles: { some: { role: { in: ADMIN_ROLES } } } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ success: true, data: reps });
}
