import { NextRequest } from 'next/server';
import { venueScoped } from '@/lib/ownership/venueEntry';
import { profileRoute } from '@/lib/venue/profileHttp';
import { discardProfileUpload } from '@/lib/venue/profileUpload';
import { venueProfileService } from '@/services/venueProfile.service';

// DELETE /api/vendor-os/profile/photos/[id] — remove one of the business's own photos (and take it off the public listing if it
// had been approved onto it). Owner only. Another business's photo is simply not found. The stored file is deleted too.
async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return profileRoute(async () => {
    // The address is read from the business's OWN profile before the row goes — never from the request.
    const url = (await venueProfileService.get()).photos.find((p) => p.id === id)?.url;
    const result = await venueProfileService.removePhoto(id);
    if ('photos' in result) await discardProfileUpload(url, 'image');
    return result;
  });
}

export const DELETE = venueScoped(handleDELETE);
