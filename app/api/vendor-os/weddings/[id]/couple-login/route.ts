import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { coupleLoginService } from '@/services/coupleLogin.service';
import { venueScoped } from '@/lib/ownership/venueEntry';

// GET  /api/vendor-os/weddings/[id]/couple-login — does the couple have a My Wedding sign-in, and does this wedding show there.
// POST /api/vendor-os/weddings/[id]/couple-login — give the couple My Wedding: a NEW login's 6-digit code is in this answer only;
//      a number that already has a login keeps its own code and only gets this wedding linked (services/coupleLogin.service.ts).
// Venue-scoped, `weddings` permission: always one of the business's own weddings. A venue never replaces anyone's code.
const noStore = { 'Cache-Control': 'no-store' };

async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json({ success: true, data: await coupleLoginService.status((await params).id) }, { headers: noStore });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handlePOST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json({ success: true, data: await coupleLoginService.give((await params).id) }, { headers: noStore });
  } catch (err) {
    return handleApiError(err);
  }
}

export const GET = venueScoped(handleGET, 'weddings');
export const POST = venueScoped(handlePOST, 'weddings');
