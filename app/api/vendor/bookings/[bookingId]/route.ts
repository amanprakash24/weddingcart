import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sharedRoute } from '@/lib/auth/workingVendor';
import { VenueBookingStatus } from '@/generated/prisma/enums';
import { venuePortalService } from '@/services/venuePortal.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

const schema = z.object({ venueStatus: z.nativeEnum(VenueBookingStatus) });

async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const gate = await sharedRoute('weddings');
  if ('refused' in gate) return gate.refused;
  try {
    const body = schema.parse(await req.json());
    return NextResponse.json({ success: true, data: await venuePortalService.updateStatus(gate.who.vendorId, (await params).bookingId, body.venueStatus) });
  } catch (error) { return handleApiError(error); }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const PATCH = platformScoped(handlePATCH);
