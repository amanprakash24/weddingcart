import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { slugify } from '@/lib/slug';
import { effectiveScope } from '@/lib/ownership/scope';
import { ENQUIRY_PAGE_SOURCE, looksAutomated, pageChannel, validateNewEnquiry } from '@/lib/venue/enquiry';
import { venueEnquiryService } from '@/services/venueEnquiry.service';

// A venue's own public enquiry page, /enquire/<slug> (11 Nov 2026, Vivah OS phase 1 — every enquiry, typed once). The venue puts the
// link on its website, Google profile, Instagram bio and WhatsApp; the couple fills it in; the enquiry lands in the venue's own
// Enquiries with where it came from (the link's ?src=), given to the venue's owner. Nobody at the venue types anything.
//
//  - The page shows only what the venue already shows the public: its name, logo and city. Nothing from its records.
//  - Sending runs as THAT venue (lib/venue/enquiryPageEntry.ts), through the same intake as "+ New Enquiry"
//    (services/venueEnquiry.service.ts `intake`): the same checks, the same client matching by mobile, the same Shaadi Shopping
//    commission rule (D4).
//  - A form filled by a program (lib/venue/enquiry.ts looksAutomated) gets the same "thank you" and is not saved; the route also
//    limits how many forms one connection may send.

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
export const isWellFormedSlug = (slug: unknown): slug is string => typeof slug === 'string' && SLUG_RE.test(slug);

export interface EnquiryPageProfile {
  businessId: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
}

export interface EnquiryPageDeps {
  db: { business: Pick<typeof prisma.business, 'findUnique' | 'updateMany'> };
  intake: typeof venueEnquiryService.intake;
  today: () => string; // YYYY-MM-DD in India
}

const defaultDeps = (): EnquiryPageDeps => ({
  db: prisma,
  intake: (e, how) => venueEnquiryService.intake(e, how),
  today: () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()),
});

// "Touch of Cozy" → "touch-of-cozy"; when taken, "touch-of-cozy-2", "-3" … Pure.
export function slugCandidates(name: string): string[] {
  const base = slugify(name) || 'venue';
  return [base, ...Array.from({ length: 48 }, (_, i) => `${base}-${i + 2}`)];
}

export function createEnquiryPageService(deps: EnquiryPageDeps = defaultDeps()) {
  return {
    // The public page: a venue's name, logo and city — or null for an unknown address, or one that is not a venue's.
    async profile(slug: unknown): Promise<EnquiryPageProfile | null> {
      if (!isWellFormedSlug(slug)) return null;
      const b = await deps.db.business.findUnique({ where: { enquirySlug: slug }, select: { id: true, name: true, kind: true, logoUrl: true, vendor: { select: { city: true } } } });
      if (!b || b.kind !== 'VENDOR') return null;
      return { businessId: b.id, name: b.name, logoUrl: b.logoUrl, city: b.vendor?.city?.trim() || null };
    },

    // The venue's own link, made the first time the team asks for it (inside the venue's scope: always its own business).
    async ensureSlug(): Promise<string> {
      const scope = effectiveScope();
      if (scope.kind !== 'BUSINESS') throw new Error('An enquiry page belongs to one business');
      const own = await deps.db.business.findUnique({ where: { id: scope.businessId }, select: { name: true, kind: true, enquirySlug: true } });
      if (!own || own.kind !== 'VENDOR') throw new NotFoundError('Business', scope.businessId);
      if (own.enquirySlug) return own.enquirySlug;
      for (const candidate of slugCandidates(own.name)) {
        if (await deps.db.business.findUnique({ where: { enquirySlug: candidate }, select: { id: true } })) continue;
        try {
          // Only while it has none — two first visits at once must not give the venue two addresses.
          await deps.db.business.updateMany({ where: { id: scope.businessId, enquirySlug: null }, data: { enquirySlug: candidate } });
        } catch (err) {
          if ((err as { code?: string })?.code === 'P2002') continue; // another venue took it a moment ago
          throw err;
        }
        const now = await deps.db.business.findUnique({ where: { id: scope.businessId }, select: { enquirySlug: true } });
        if (now?.enquirySlug) return now.enquirySlug;
      }
      throw new Error('Could not choose an address for the enquiry page');
    },

    // The couple sends the form. Runs inside the venue's scope (lib/venue/enquiryPageEntry.ts). `saved: false` only for a form a
    // program filled — it is answered like a real one.
    async receive(slug: unknown, body: Record<string, unknown>): Promise<{ ok: true; firstName: string; saved: boolean } | { ok: false; errors: Record<string, string> }> {
      const page = await this.profile(slug);
      if (!page) throw new NotFoundError('Enquiry page', String(slug));
      const scope = effectiveScope();
      if (scope.kind !== 'BUSINESS' || scope.businessId !== page.businessId) throw new Error('The enquiry page must run as its own venue');
      const checked = validateNewEnquiry({ ...body, channel: pageChannel(body.src) }, deps.today());
      if (looksAutomated(body)) return { ok: true, firstName: checked.ok ? checked.value.name.split(' ')[0] : 'there', saved: false };
      if (!checked.ok) return { ok: false, errors: checked.errors };
      await deps.intake(checked.value, { sourceDetail: ENQUIRY_PAGE_SOURCE, actorId: null });
      return { ok: true, firstName: checked.value.name.split(' ')[0], saved: true };
    },
  };
}

export const enquiryPageService = createEnquiryPageService();
