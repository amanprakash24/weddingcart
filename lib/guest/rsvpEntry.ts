import { prisma } from '@/lib/prisma';
import { PLATFORM_SCOPE, runAsSystem, runInScope, type Scope } from '@/lib/ownership/scope';
import { weddingScope } from '@/lib/customer/coupleEntry';

// A guest's RSVP link (/rsvp/<token>) for ANY business's wedding. Like the proposal link (lib/quotation/proposalEntry.ts), the
// link carries only the guest's secret token, so the entry first asks — as a named SYSTEM lookup, allowlisted in CI, reading
// nothing but the owner — whose wedding the guest is on, and then runs the page / action as THAT business.
// Before (found 19 Nov 2026): the page always ran as Shaadi Shopping, so every guest of a venue's wedding got "Page Not Found".
// An unknown or malformed token runs as Shaadi Shopping and is answered "not found" as before.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function scopeForRsvpToken(token: unknown): Promise<Scope> {
  if (typeof token !== 'string' || !UUID.test(token)) return PLATFORM_SCOPE;
  const owner = await runAsSystem('rsvp link: whose wedding is this guest on', () =>
    prisma.guest.findUnique({ where: { rsvpToken: token }, select: { wedding: { select: { businessId: true } } } })
  );
  return owner?.wedding ? weddingScope(owner.wedding.businessId) : PLATFORM_SCOPE;
}

type Params = { params: Promise<{ token: string }> };

// For app/api/rsvp/[token]: (req, { params }).
export function rsvpScoped<Req, R>(fn: (req: Req, ctx: Params) => Promise<R>): (req: Req, ctx: Params) => Promise<R> {
  return async (req, ctx) => runInScope(await scopeForRsvpToken((await ctx.params).token), () => fn(req, ctx));
}

// For the page: ({ params }).
export function rsvpPageScoped<R>(fn: (props: Params) => Promise<R>): (props: Params) => Promise<R> {
  return async (props) => runInScope(await scopeForRsvpToken((await props.params).token), () => fn(props));
}
