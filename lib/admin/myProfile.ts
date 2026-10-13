// "My profile" in the Command Center (13 Oct 2026): each person on Shaadi Shopping's own team — the founder first — has a face and
// a name: photo, name, designation. Until now the admin showed nobody: no name in the menu, no photo, no page about yourself.
// Pure and browser-safe: the form and the server share these rules (services/adminProfile.service.ts).

export const PROFILE_LIMITS = { nameMax: 80, designationMax: 60, photoMaxBytes: 10 * 1024 * 1024 } as const;

// The browser event that tells the menu (components/admin/AdminShell.tsx) the person's name or photo changed.
export const PROFILE_CHANGED = 'admin-profile-changed';

export interface MyProfile {
  name: string | null;
  designation: string | null; // "Founder & CEO", "Wedding planner" — their own words
  photoUrl: string | null;
  role: 'SUPER_ADMIN' | 'SALES' | 'OPERATIONS';
  email: string | null;
  mobile: string | null; // masked — the whole number is only needed in My sign-in
  hasCode: boolean;
  hasPassword: boolean;
  since: string; // ISO date the login was made
}

export type ProfileField = 'name' | 'designation' | 'photoUrl';
export type ProfileErrors = Partial<Record<ProfileField, string>>;

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

// A photo is only ever one of OUR uploads (/api/upload → Cloudinary) — never a link to somewhere else.
export function isOwnUpload(url: unknown, cloudName: string | undefined): url is string {
  if (typeof url !== 'string' || !cloudName) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'res.cloudinary.com' && u.pathname.startsWith(`/${cloudName}/image/upload/`);
  } catch {
    return false;
  }
}

// What may be saved: name (required), designation (may be emptied), photo (one of our uploads, or null to take it off).
// Only the fields that are present in the request are checked and returned.
export function checkProfile(input: Record<string, unknown>, cloudName: string | undefined): { ok: true; value: { name?: string; designation?: string | null; photoUrl?: string | null } } | { ok: false; errors: ProfileErrors } {
  const errors: ProfileErrors = {};
  const value: { name?: string; designation?: string | null; photoUrl?: string | null } = {};
  if (input.name !== undefined) {
    const name = clean(input.name);
    if (name.length < 2) errors.name = 'Your name';
    else if (name.length > PROFILE_LIMITS.nameMax) errors.name = `Up to ${PROFILE_LIMITS.nameMax} characters`;
    else value.name = name;
  }
  if (input.designation !== undefined) {
    const designation = clean(input.designation);
    if (designation.length > PROFILE_LIMITS.designationMax) errors.designation = `Up to ${PROFILE_LIMITS.designationMax} characters`;
    else value.designation = designation || null;
  }
  if (input.photoUrl !== undefined) {
    if (input.photoUrl === null || input.photoUrl === '') value.photoUrl = null;
    else if (isOwnUpload(input.photoUrl, cloudName)) value.photoUrl = input.photoUrl;
    else errors.photoUrl = 'Please upload the photo here';
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value };
}

// The two letters shown where there is no photo.
export function initials(name: string | null | undefined): string {
  const parts = clean(name).split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
