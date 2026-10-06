import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';
import { platformScoped } from '@/lib/ownership/entry';

// Powers the "Sales Person" filter dropdown (components/crm/LeadFilters.tsx) —
// anyone holding an admin-class role can be assigned a lead.
async function handleGET() {
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

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
