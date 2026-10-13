import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueTeamService } from '@/services/venueTeam.service';
import { MEMBER, venueScoped } from '@/lib/ownership/venueEntry';

// PUT /api/vendor-os/team/me — { name }: the signed-in person sets their own name ("Your name" on the Team screen). Any member —
// it is their own account's name, and nobody else's can be reached from here: the person comes from the session, never the request.
async function handlePUT(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) ?? {};
    const result = await venueTeamService.setMyName(body.name);
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
}

export const PUT = venueScoped(handlePUT, MEMBER);
