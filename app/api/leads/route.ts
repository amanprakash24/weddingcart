import { NextRequest, NextResponse } from 'next/server';
import { leadService } from '@/services/lead.service';
import { requireAdmin } from '@/lib/adminAuth';
import type { Lead } from '@/generated/prisma/client';

// Admin UI still expects an `_id` field (Prisma's is `id`). Shaping happens
// here at the route boundary, not in the repository/service.
function toResponseShape(lead: Lead) {
  return { ...lead, _id: lead.id };
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { data } = await leadService.list();
    return NextResponse.json({ success: true, data: data.map(toResponseShape) });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { phone, whatsapp } = await req.json();
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ success: false, error: 'Valid phone number required' }, { status: 400 });
    }
    await leadService.create({ phone, whatsapp: !!whatsapp });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to save lead' }, { status: 500 });
  }
}
