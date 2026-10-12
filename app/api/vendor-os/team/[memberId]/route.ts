import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueTeamService } from '@/services/venueTeam.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// PATCH /api/vendor-os/team/[memberId] — { role, jobTitle?, seesMoney? } for one person in the team.
// DELETE /api/vendor-os/team/[memberId] — take them out of the team; their access ends at once.
// Venue-scoped, `team` permission. Never an owner, never yourself (services/venueTeam.service.ts).
type Ctx = { params: Promise<{ memberId: string }> };

async function handlePATCH(req: NextRequest, { params }: Ctx) {
  try {
    const result = await venueTeamService.change((await params).memberId, (await req.json().catch(() => ({}))) ?? {});
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400 });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handleDELETE(_req: NextRequest, { params }: Ctx) {
  try {
    return NextResponse.json({ success: true, data: await venueTeamService.remove((await params).memberId) });
  } catch (err) {
    return handleApiError(err);
  }
}

export const PATCH = venueScoped(handlePATCH, 'team');
export const DELETE = venueScoped(handleDELETE, 'team');
