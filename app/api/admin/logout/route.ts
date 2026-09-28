import type { NextRequest } from 'next/server';
import { logoutEverywhere } from '@/lib/auth/logout';

// Admin "Log out" (AdminShell.tsx). Ends this user's sessions on every device, then clears this
// browser's cookie — see lib/auth/logout.ts.
export async function POST(req: NextRequest) {
  return logoutEverywhere(req);
}
