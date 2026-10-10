import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { venueWeddingService } from '@/services/venueWedding.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// POST /api/vendor-os/weddings/[id]/tasks — add a to-do to the business's own wedding: { title, dueOn?: YYYY-MM-DD }. Venue-scoped.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await venueWeddingService.addTask((await params).id, body ?? {}, (await getSession())?.user?.id ?? null);
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST, 'weddings');
