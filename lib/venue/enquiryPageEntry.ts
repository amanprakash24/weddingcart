import { PLATFORM_SCOPE, runInScope, type Scope } from '@/lib/ownership/scope';
import { enquiryPageService } from '@/services/enquiryPage.service';

// The venue's public enquiry page (/enquire/<slug>, 11 Nov 2026). Like the couple's proposal link (lib/quotation/proposalEntry.ts),
// the address names the business: the entry looks the venue up by its page address — a public field of the business, not one of its
// records, so no cross-business lookup is needed — and then runs the request as THAT venue, so the enquiry is created in the venue's
// own records and nowhere else. An unknown address runs as Shaadi Shopping and is answered "not found".
// Role STAFF: the couple is not a member; nothing permission-gated is reachable from this route.
export async function scopeForEnquiryPage(slug: unknown): Promise<Scope> {
  const page = await enquiryPageService.profile(slug);
  return page ? { kind: 'BUSINESS', businessId: page.businessId, role: 'STAFF' } : PLATFORM_SCOPE;
}

type Params = { params: Promise<{ slug: string }> };

// For app/api/enquire/[slug] routes: (req, { params }).
export function enquiryPageScoped<Req, R>(fn: (req: Req, ctx: Params) => Promise<R>): (req: Req, ctx: Params) => Promise<R> {
  return async (req, ctx) => runInScope(await scopeForEnquiryPage((await ctx.params).slug), () => fn(req, ctx));
}
