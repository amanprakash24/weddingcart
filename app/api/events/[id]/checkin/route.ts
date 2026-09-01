import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { eventService } from '@/services/event.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const ticket = await eventService.checkIn(id, body.ticketId);
    return NextResponse.json({ success: true, data: { id, ticket } });
  } catch (error) {
    console.error('POST /api/events/[id]/checkin failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to check in ticket';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
