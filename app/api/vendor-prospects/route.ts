import { NextRequest, NextResponse } from 'next/server';
import { vendorProspectService } from '@/services/vendorProspect.service';
import { requireAdmin } from '@/lib/adminAuth';
import type { VendorProspectStatus } from '@/generated/prisma/client';

const VALID_STATUSES: VendorProspectStatus[] = ['NEW', 'CONTACTED', 'INTERESTED', 'ONBOARDING', 'ONBOARDED', 'DECLINED', 'ALREADY_LISTED'];

function toStatus(value: string | null): VendorProspectStatus | undefined {
  return value && (VALID_STATUSES as string[]).includes(value) ? (value as VendorProspectStatus) : undefined;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const status = toStatus(searchParams.get('status'));
    const city = searchParams.get('city') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 500);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);

    const { data, total } = await vendorProspectService.list({ status, city, search, skip: (page - 1) * limit, take: limit });
    return NextResponse.json({ success: true, data, total });
  } catch (err) {
    console.error('GET /api/vendor-prospects failed:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch vendor prospects' }, { status: 500 });
  }
}
