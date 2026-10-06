import { PLATFORM_SCOPE, runInScope, type Scope } from './scope';

// Entry points (docs/wedding-os/15-record-ownership.md §4.7). Every API route and every server page that touches owned records runs
// inside one of these; lib/ownership/entry.test.ts fails CI when a route does not.
//
//   export const GET = platformScoped(handleGet);   // the work is Shaadi Shopping's: staff screens, the public website and its
//                                                   // forms, payment webhooks, and what Shaadi Shopping shares with a vendor or a
//                                                   // couple (their availability requests, bookings, proposal link, portal)
//
// Phase C adds a business-scoped entry for a venue's own screens, resolved from the venue login — never from the request.

type Fn<A extends unknown[], R> = (...args: A) => R;

export function scoped<A extends unknown[], R>(scope: Scope, fn: Fn<A, R>): Fn<A, R> {
  return (...args: A) => runInScope(scope, () => fn(...args));
}

export const platformScoped = <A extends unknown[], R>(fn: Fn<A, R>): Fn<A, R> => scoped(PLATFORM_SCOPE, fn);
