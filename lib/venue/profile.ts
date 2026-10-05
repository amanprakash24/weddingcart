// The business profile a vendor completes on first sign-in (6 Oct 2026): name, logo, photos, an optional video and an optional GST
// number. Pure and client-safe — the form and the server share these rules. The profile is the letterhead of every document the
// business sends (quotation, invoice) and, once Shaadi Shopping approves the photos, what its public listing shows.

// "Keep items so that we do not get too much load" (founder, 6 Oct 2026): every number that bounds storage and bandwidth is here.
export const PROFILE_LIMITS = {
  nameMax: 120,
  photosMin: 3, // needed before the profile counts as complete
  photosMax: 12,
  imageBytes: 4 * 1024 * 1024, // under Vercel's 4.5 MB request cap — the real ceiling for an upload through our own route
  imageMaxEdge: 1600, // px: every stored photo is scaled down to fit this box
  logoMaxEdge: 600,
  videoSeconds: 60,
  videoBytes: 50 * 1024 * 1024,
} as const;

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

// ---- GST number (GSTIN) ----

const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// As printed on a certificate: 15 characters, capitals, no spaces. '' when nothing was typed.
export const normalizeGstin = (input: unknown) => text(input).replace(/[\s-]/g, '').toUpperCase();

// The 15th character is a check character over the first 14 (the GSTN's own scheme), so a mistyped number is caught here
// rather than on a customer's invoice.
export function gstinCheckCharacter(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = GSTIN_ALPHABET.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_ALPHABET[(36 - (sum % 36)) % 36];
}

export function isValidGstin(gstin: string): boolean {
  if (!GSTIN_SHAPE.test(gstin)) return false;
  const state = Number(gstin.slice(0, 2));
  if (state < 1 || state > 38) return false; // state / UT codes 01–38
  return gstinCheckCharacter(gstin.slice(0, 14)) === gstin[14];
}

// ---- video: an upload of ours, or a link that costs us no storage ----

// A link to the venue's own video on YouTube or Instagram. Returns the cleaned https link, or null.
export function videoLink(input: unknown): string | null {
  const raw = text(input);
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
  if (url.protocol !== 'https:' || !['youtube.com', 'youtu.be', 'instagram.com'].includes(host)) return null;
  return url.toString();
}

// ---- our own storage ----

// A photo, logo or video the business uploaded through OUR upload routes: an https Cloudinary address in our own cloud, under the
// one folder those routes write to. Nothing else is ever saved as media — never an address the browser merely claims.
export function isOwnUpload(url: unknown, cloudName: string, folder: string): url is string {
  if (typeof url !== 'string' || !cloudName) return false;
  const prefix = `https://res.cloudinary.com/${cloudName}/`;
  if (!url.startsWith(prefix) || /[\s"'<>\\?#]/.test(url) || url.includes('..')) return false;
  return `/${url.slice(prefix.length)}`.includes(`/${folder}/`);
}

// ---- the profile form ----

export interface ProfileInput {
  name: string;
  gstin: string | null;
  videoLink: string | null;
}

export type ProfileErrors = Partial<Record<'name' | 'gstin' | 'videoLink', string>>;

// The typed fields (logo, photos and an uploaded video are saved by their own upload steps).
export function validateProfile(input: Record<string, unknown>): { ok: true; value: ProfileInput } | { ok: false; errors: ProfileErrors } {
  const errors: ProfileErrors = {};

  const name = text(input.name).replace(/\s+/g, ' ');
  if (name.length < 2) errors.name = 'Enter the name of your business as your customers know it';
  else if (name.length > PROFILE_LIMITS.nameMax) errors.name = `Please keep it under ${PROFILE_LIMITS.nameMax} characters`;

  const gstin = normalizeGstin(input.gstin);
  if (gstin && !isValidGstin(gstin)) errors.gstin = 'That is not a valid GST number — please check it against your GST certificate, or leave it empty';

  const typedLink = text(input.videoLink);
  const link = videoLink(typedLink);
  if (typedLink && !link) errors.videoLink = 'Paste a link to your video on YouTube or Instagram (starting with https://)';

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, gstin: gstin || null, videoLink: link } };
}

// ---- is the profile complete? ----

export type ProfileStep = 'name' | 'logo' | 'photos';

// What still has to be done before the business can use the dashboard, in the order it is asked. Video and GST number are optional.
export function missingProfileSteps(p: { name: string | null; logoUrl: string | null; photoCount: number }): ProfileStep[] {
  const missing: ProfileStep[] = [];
  if (!p.name || p.name.trim().length < 2) missing.push('name');
  if (!p.logoUrl) missing.push('logo');
  if (p.photoCount < PROFILE_LIMITS.photosMin) missing.push('photos');
  return missing;
}

export const PROFILE_STEP_WORDS: Record<ProfileStep, string> = {
  name: 'your business name',
  logo: 'your logo',
  photos: `at least ${PROFILE_LIMITS.photosMin} photos`,
};
