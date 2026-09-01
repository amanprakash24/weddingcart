import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { eventService } from '@/services/event.service';

export async function GET() {
  const events = await eventService.listPublished();
  return NextResponse.json({ success: true, data: events });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const event = await eventService.create({
      slug: body.slug,
      name: body.name,
      date: body.date,
      time: body.time ?? null,
      venueName: body.venueName,
      venueAddress: body.venueAddress ?? null,
      description: body.description ?? '',
      coverImage: body.coverImage ?? '',
      capacity: body.capacity ?? null,
      status: body.status ?? 'DRAFT',
      passTypes: Array.isArray(body.passTypes) ? body.passTypes : [],
    });

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    console.error('POST /api/events failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to create event';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
