import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { eventService } from '@/services/event.service';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await eventService.getById(id);
  if (!event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }

  const isAdmin = await requireAdmin();
  if (event.status !== 'PUBLISHED' && !isAdmin) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: event });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const event = await eventService.update(id, {
      slug: body.slug,
      name: body.name,
      date: body.date,
      time: body.time ?? null,
      venueName: body.venueName,
      venueAddress: body.venueAddress ?? null,
      description: body.description,
      coverImage: body.coverImage,
      capacity: body.capacity,
      status: body.status,
    });

    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update event';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const event = await eventService.getById(id);
  if (!event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }

  await eventService.update(id, { status: 'CANCELLED' });
  return NextResponse.json({ success: true, data: { id } });
}
