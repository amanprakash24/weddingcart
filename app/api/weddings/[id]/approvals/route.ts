import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { approvalService } from '@/services/approval.service';
import { handleApiError } from '@/lib/errors';
import { ApprovalSubjectType } from '@/generated/prisma/client';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole(ADMIN_ROLES))) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    return NextResponse.json({ success: true, data: await approvalService.listForWedding(id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const body = await req.json();
    if (!Object.values(ApprovalSubjectType).includes(body.subjectType) || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ success: false, error: 'A valid type and title are required' }, { status: 400 });
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
