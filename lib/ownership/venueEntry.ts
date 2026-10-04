import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { venueBusinessService } from '@/services/venueBusiness.service';
import { runInScope } from './scope';

// Entry for a venue's OWN screens (Phase C): the scope is the business of the logged-in vendor login — resolved from the session,
// never from the request — and everything the handler does is limited to it by the database guard. Not a vendor login, or not tied
// to a vendor → 401, and nothing runs.
//
//   export const POST = venueScoped(handlePOST);
export function venueScoped<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R | NextResponse> {
  return async (...args: A) => {
    const session = await requireRole([Role.VENDOR]);
    const scope = session?.user?.id ? await venueBusinessService.scopeForVendorLogin(session.user.id) : null;
    if (!scope) return NextResponse.json({ success: false, error: 'Please log in to your Vivah OS account' }, { status: 401 });
    return runInScope(scope, () => fn(...args));
  };
}
