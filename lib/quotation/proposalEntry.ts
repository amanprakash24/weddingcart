import { prisma } from '@/lib/prisma';
import { PLATFORM_SCOPE, runAsSystem, runInScope, type Scope } from '@/lib/ownership/scope';
import { hashCustomerToken, isWellFormedToken } from './proposal';

// The couple's proposal link (/proposal/<token>) for ANY business's quotation (Phase C groundwork, D8). The link carries only the
// secret token, so the entry first asks — as a named SYSTEM lookup, allowlisted in CI, reading nothing but the owner — whose
// quotation it is, and then runs the page / action as THAT business: a venue's link works in the venue's records, Shaadi Shopping's
// in Shaadi Shopping's. An unknown token runs as Shaadi Shopping and is answered "no longer valid" as before.

export async function scopeForProposalToken(token: unknown): Promise<Scope> {
  if (!isWellFormedToken(token)) return PLATFORM_SCOPE;
  const hash = hashCustomerToken(token);
  const owner = await runAsSystem('proposal link: whose quotation is this', () =>
    prisma.quotation.findFirst({ where: { customerTokenHash: hash }, select: { businessId: true } })
  );
  return owner ? { kind: 'BUSINESS', businessId: owner.businessId, role: 'STAFF' } : PLATFORM_SCOPE;
}

type Params = { params: Promise<{ token: string }> };

// For app/api/proposal/[token]/* routes: (req, { params }).
export function proposalScoped<Req, R>(fn: (req: Req, ctx: Params) => Promise<R>): (req: Req, ctx: Params) => Promise<R> {
  return async (req, ctx) => runInScope(await scopeForProposalToken((await ctx.params).token), () => fn(req, ctx));
}

// For the page: ({ params }).
export function proposalPageScoped<R>(fn: (props: Params) => Promise<R>): (props: Params) => Promise<R> {
  return async (props) => runInScope(await scopeForProposalToken((await props.params).token), () => fn(props));
}
