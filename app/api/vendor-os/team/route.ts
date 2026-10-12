import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { venueTeamService } from '@/services/venueTeam.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET /api/vendor-os/team — who works in the business (lib/venue/team.ts).
// POST /api/vendor-os/team — { name, mobile, role, jobTitle?, seesMoney? }: add a person. A NEW login's 6-digit code is in this
// answer only — it is never readable again, so the answer is never cached.
// Venue-scoped, `team` permission (the owner, by default): always the logged-in business's own team.
const noStore = { 'Cache-Control': 'no-store' };

async function handleGET() {
  try {
    return NextResponse.json({ success: true, data: await venueTeamService.list() }, { headers: noStore });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const result = await venueTeamService.add((await req.json().catch(() => ({}))) ?? {});
    if ('errors' in result) return NextResponse.json({ success: false, error: 'Please check the highlighted fields', fieldErrors: result.errors }, { status: 400, headers: noStore });
    return NextResponse.json({ success: true, data: result }, { status: 201, headers: noStore });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, 'team');
export const POST = venueScoped(handlePOST, 'team');
