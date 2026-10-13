import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { venueWeddingService } from '@/services/venueWedding.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// POST /api/vendor-os/weddings/[id]/notes — { note }: a note about the business's own wedding, kept in its history under the
// writer's name (never edited or removed). Venue-scoped; from someone who may work on its weddings.
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = (await req.json().catch(() => ({}))) ?? {};
    const result = await venueWeddingService.addNote((await params).id, body.note, (await getSession())?.user?.id ?? null);
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export const POST = venueScoped(handlePOST, 'weddings');
