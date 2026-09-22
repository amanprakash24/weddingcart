import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { vendorProspectService } from '@/services/vendorProspect.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';

const schema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'INTERESTED', 'ONBOARDING', 'ONBOARDED', 'DECLINED', 'ALREADY_LISTED']),
  notes: z.string().trim().max(2000).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const parsed = schema.parse(await req.json());

    const prospect = await vendorProspectService.updateStatus(id, parsed.status, parsed.notes);
    if (!prospect) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: prospect });
  } catch (err) {
    return handleApiError(err);
  }
}
