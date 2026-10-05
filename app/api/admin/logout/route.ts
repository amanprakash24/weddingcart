import type { NextRequest } from 'next/server';
import { logoutEverywhere } from '@/lib/auth/logout';
import { platformScoped } from '@/lib/ownership/entry';

// Admin "Log out" (AdminShell.tsx). Ends this user's sessions on every device, then clears this
// browser's cookie — see lib/auth/logout.ts.
async function handlePOST(req: NextRequest) {
  return logoutEverywhere(req);
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
