import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { leadInboxService } from '@/services/leadInbox.service';
import type { PipelineStage } from '@/generated/prisma/enums';
import type { SourceType } from '@/services/leadInbox.service';

const VALID_STAGES: PipelineStage[] = [
  'NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT_SCHEDULED', 'QUOTATION_SENT', 'NEGOTIATION', 'WON', 'LOST',
];
const VALID_SOURCE_TYPES: SourceType[] = ['LEAD', 'ENQUIRY', 'CONSULTATION'];

export async function GET(req: NextRequest) {
  if (!(await requireRole(ADMIN_ROLES))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const stageParam = searchParams.get('stage');
  const sourceTypeParam = searchParams.get('sourceType');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));

  const result = await leadInboxService.list({
    search: searchParams.get('search') ?? undefined,
    pipelineStage: stageParam && VALID_STAGES.includes(stageParam as PipelineStage) ? (stageParam as PipelineStage) : undefined,
    city: searchParams.get('city') ?? undefined,
    assignedToId: searchParams.get('assignedToId') ?? undefined,
    sourceType: sourceTypeParam && VALID_SOURCE_TYPES.includes(sourceTypeParam as SourceType) ? (sourceTypeParam as SourceType) : undefined,
    dateFrom: searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined,
    dateTo: searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined,
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json({
    success: true,
    data: result.data,
    pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
  });
}
