import { cookies } from 'next/headers';

// The workspace a signed-in person chose (7 Oct 2026): one person may be a member of several businesses — "Rahul: Venue A, manager;
// Decorator B, coordinator" — and after signing in they choose which one they are working in. The choice is remembered in a
// cookie. It is only ever a PREFERENCE: every request checks it against the person's memberships in the database
// (services/venueBusiness.service.ts), so editing the cookie gets nobody into a business they do not belong to.
export const WORKSPACE_COOKIE = 'vivah_ws';

export const workspaceCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

// The business id in the cookie, or null. Never throws: outside a request (a test, a script) there is simply no choice.
export async function chosenWorkspace(): Promise<string | null> {
  try {
    const value = (await cookies()).get(WORKSPACE_COOKIE)?.value;
    return value && /^[A-Za-z0-9-]{1,64}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

// Where each kind of workspace opens.
export const workspaceHome = (kind: 'PLATFORM' | 'VENDOR') => (kind === 'PLATFORM' ? '/admin' : '/vendor/today');
