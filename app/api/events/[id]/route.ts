import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getSession } from '@/lib/auth/session';
import { hasAdminRole, hasSuperAdmin } from '@/lib/auth/permissions';
import { eventView } from '@/lib/events/view';
import { eventService } from '@/services/event.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { readJsonBody } from '@/lib/readJsonBody';

async function handleGET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await eventService.getById(id);
  if (!event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }

  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  const isAdmin = hasAdminRole(roles);
  if (event.status !== 'PUBLISHED' && !isAdmin) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: eventView(event, { isAdmin, isFounder: hasSuperAdmin(roles) }) });
}

async function handlePUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await readJsonBody(req);
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
    return handleApiError(error);
  }
}

async function handleDELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const PUT = platformScoped(handlePUT);
export const DELETE = platformScoped(handleDELETE);
