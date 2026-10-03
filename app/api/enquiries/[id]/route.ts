import { NextRequest, NextResponse } from 'next/server';
import { enquiryService } from '@/services/enquiry.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';

// Retired 4 Oct 2026 (MASTER-GAP-ANALYSIS §2.4.2): this changed the legacy `status`, a second state the CRM never saw. The CRM
// stage is now the only status — change it from the CRM (/api/crm/leads/[sourceType]/[id]/stage).
export async function PUT() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ success: false, error: 'This screen was retired — change the status in Leads & Quotes (the CRM).' }, { status: 410 });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    await enquiryService.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
