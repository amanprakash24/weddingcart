import { NextRequest } from 'next/server';
import { venueScoped } from '@/lib/ownership/venueEntry';
import { profileRoute } from '@/lib/venue/profileHttp';
import { venueProfileService } from '@/services/venueProfile.service';

// GET /api/vendor-os/profile — the business profile: name, logo, GST number, video, photos, and what is still missing.
// PUT /api/vendor-os/profile — the typed fields: { name, gstin }. Owner only.
// Venue-scoped (lib/ownership/venueEntry.ts): always the logged-in vendor's own business, never one named by the request.
const handleGET = () => profileRoute(() => venueProfileService.get());

async function handlePUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return profileRoute(() => venueProfileService.update({ name: body?.name, gstin: body?.gstin }));
}

export const GET = venueScoped(handleGET);
export const PUT = venueScoped(handlePUT);
