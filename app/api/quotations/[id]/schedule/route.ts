import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { moneyDenied } from '@/lib/auth/moneyGuard';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { MAX_INSTALMENTS } from '@/lib/money/schedule';
import { paymentScheduleService } from '@/services/paymentSchedule.service';
import { platformScoped } from '@/lib/ownership/entry';

// GET /api/quotations/[id]/schedule: the payment schedule of an accepted quotation's agreement (instalments, and what is paid of each).
// PUT replaces the whole schedule: { instalments: [{ label, amount, dueDate: 'YYYY-MM-DD' }], expectedVersion }.
// The instalments must add up to the balance exactly; a save from an out-of-date screen gets 409 (services/paymentSchedule.service.ts).
// Same money permission as recording a payment: reading needs 'read', changing needs 'full' on this quotation.

const body = z.object({
  instalments: z
    .array(z.object({ label: z.string().max(200), amount: z.number(), dueDate: z.string().max(10) }))
    .max(MAX_INSTALMENTS + 1),
  expectedVersion: z.number().int().min(0),
});

async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const denied = await moneyDenied({ quotation: id }, 'read');
  if (denied) return denied;
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ success: true, data: await paymentScheduleService.get(id) });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const denied = await moneyDenied({ quotation: id }, 'full');
  if (denied) return denied;
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const parsed = body.parse(await req.json());
    return NextResponse.json({ success: true, data: await paymentScheduleService.set(id, parsed, session.user.id ?? null) });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const PUT = platformScoped(handlePUT);
