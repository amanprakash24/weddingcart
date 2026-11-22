import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { moneyAccessFor, moneyDenied } from '@/lib/auth/moneyGuard';
import { hasMoneyAccess } from '@/lib/auth/moneyAccess';
import { approvalService } from '@/services/approval.service';
import { handleApiError } from '@/lib/errors';
import { ApprovalSubjectType } from '@/generated/prisma/client';
import { platformScoped } from '@/lib/ownership/entry';

// Approvals are everyday coordination with the couple, open to the whole team. An approval's amount is wedding money: it is left
// out for anyone without access to this wedding's money, and only someone with full access may ask the couple to approve one
// (lib/auth/moneyAccess.ts).
async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const approvals = await approvalService.listForWedding(id);
    const access = await moneyAccessFor(session, { wedding: id });
    const data = hasMoneyAccess(access, 'read') ? approvals : approvals.map((a) => ({ ...a, amount: null }));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const body = await req.json();
    if (!Object.values(ApprovalSubjectType).includes(body.subjectType) || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ success: false, error: 'A valid type and title are required' }, { status: 400 });
    }
    if (body.amount !== undefined && body.amount !== '' && body.amount !== null) {
      const denied = await moneyDenied({ wedding: id }, 'full');
      if (denied) return denied;
    }
    return NextResponse.json({ success: true, data: await approvalService.create(id, {
      subjectType: body.subjectType,
      weddingEventId: body.weddingEventId || undefined,
      title: body.title,
      description: body.description,
      amount: body.amount === undefined || body.amount === '' ? undefined : Number(body.amount),
      deadline: body.deadline ? new Date(body.deadline) : undefined,
    }, session.user.id) });
  } catch (error) {
    return handleApiError(error);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const POST = platformScoped(handlePOST);
