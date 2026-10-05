import { NextRequest } from 'next/server';
import { venueScoped } from '@/lib/ownership/venueEntry';
import { profileRoute } from '@/lib/venue/profileHttp';
import { venueProfileService } from '@/services/venueProfile.service';

// DELETE /api/vendor-os/profile/photos/[id] — remove one of the business's own photos (and take it off the public listing if it
// had been approved onto it). Owner only. Another business's photo is simply not found.
async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return profileRoute(() => venueProfileService.removePhoto(id));
}

export const DELETE = venueScoped(handleDELETE);
