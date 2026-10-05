import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { requiredConfirmation, type CommercialRules } from '@/lib/commercial/rules';
import { resolveSourceDate } from '@/lib/quotation/booking';
import { currentBusiness, rulesOf } from '@/lib/ownership/business';
import { lineTotal, quoteStage, validateVenueQuote, type QuoteStage, type VenueQuoteErrors } from '@/lib/venue/quotation';
import { quotationService, type QuotationView } from '@/services/quotation.service';

// A venue's OWN quotation for one of its own enquiries (Phase C). A thin adapter: every rule that matters — one open quotation
// per enquiry, a sent quotation is never edited, revisions, expiry, the couple's link, acceptance, the booking and its agreement —
// is the existing quotation service, unchanged. Always called inside the venue's scope (lib/ownership/venueEntry.ts): the database
// guard limits every read and write here to that venue's business, so another business's enquiry or quotation is "not found".
//
// What this adds for a venue: the amount that confirms the booking is not typed — it is the venue's own rule (Settings) applied to
// the total, the same rule the agreement freezes when the couple accepts; and the enquiry gets the venue's city, so the booking
// can be made the moment the couple accepts.

const istToday = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
const endOfIstDay = (day: string) => new Date(`${day}T23:59:59+05:30`);

export interface VenueQuotationView {
  id: string;
  number: string;
  revision: number;
  stage: QuoteStage;
  items: { description: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  total: number;
  toConfirm: number; // what confirms the booking — the venue's rule on the total (frozen in the agreement once accepted)
  confirmationPercent: number;
  validUntil: string | null; // YYYY-MM-DD (IST)
  inclusions: string | null;
  exclusions: string | null;
  terms: string | null;
  sentAt: string | null;
  openedAt: string | null; // first time the couple opened the link
  changesNote: string | null; // what the couple asked to change
  acceptedAt: string | null;
  hasLink: boolean;
  // After the couple accepts: the booking and what it takes to confirm it. null = not made yet (the wedding date is needed).
  booking: { holdWindowDays: number } | null;
}

export interface VenueQuotationState {
  customer: { name: string; phone: string; weddingDate: string | null };
  venueName: string;
  rules: Pick<CommercialRules, 'confirmationPercent' | 'holdWindowDays'>;
  quotation: VenueQuotationView | null;
  // The venue's listing packages, offered as one-tap starting lines for a new quotation.
  packages: { name: string; price: number; perPlate: boolean }[];
}

export type SaveResult = VenueQuotationState | { errors: VenueQuoteErrors };
// The couple's link is shown ONCE, when it is made — only its hash is stored (services/quotation.service.ts).
export type LinkResult = VenueQuotationState & { linkPath: string };

export interface VenueQuotationDeps {
  db: {
    consultation: Pick<typeof prisma.consultation, 'findUnique' | 'update'>;
    business: Pick<typeof prisma.business, 'findUnique'>;
    vendorPackage: Pick<typeof prisma.vendorPackage, 'findMany'>;
    commercialAgreement: Pick<typeof prisma.commercialAgreement, 'findUnique'>;
  };
  quotations: Pick<typeof quotationService, 'listForSource' | 'create' | 'update' | 'send' | 'revise' | 'issueCustomerLink' | 'createBooking'>;
  business: typeof currentBusiness;
  now: () => Date;
}

const defaultDeps = (): VenueQuotationDeps => ({ db: prisma, quotations: quotationService, business: currentBusiness, now: () => new Date() });

export function createVenueQuotationService(deps: VenueQuotationDeps = defaultDeps()) {
  async function enquiry(id: string) {
    const row = await deps.db.consultation.findUnique({ where: { id }, select: { id: true, name: true, phone: true, weddingDate: true, city: true, pipelineStage: true } });
    if (!row) throw new NotFoundError('Enquiry', id);
    return row;
  }

  // The current quotation: the newest one that was not replaced by a revision.
  async function current(enquiryId: string): Promise<QuotationView | null> {
    const all = await deps.quotations.listForSource('CONSULTATION', enquiryId);
    return all.find((q) => q.status !== 'SUPERSEDED') ?? null;
  }

  async function venue() {
    const business = await deps.business();
    if (business.kind !== 'VENDOR') throw new NotFoundError('Business', business.id);
    const listing = await deps.db.business.findUnique({ where: { id: business.id }, select: { vendorId: true, vendor: { select: { city: true } } } });
    return { business, rules: rulesOf(business), vendorId: listing?.vendorId ?? null, city: listing?.vendor?.city?.trim() || null };
  }

  async function toView(q: QuotationView, rules: CommercialRules): Promise<VenueQuotationView | null> {
    const stage = quoteStage({ status: q.status, changesRequested: q.changesRequestedAt !== null });
    if (!stage) return null;
    // Once accepted, the agreement holds the rule this deal was made with — never today's setting.
    const agreement = stage === 'ACCEPTED' ? await deps.db.commercialAgreement.findUnique({ where: { quotationId: q.id }, select: { confirmationPercent: true, confirmationAmount: true, holdWindowDays: true } }) : null;
    return {
      id: q.id,
      number: q.quotationNumber,
      revision: q.revision,
      stage,
      items: q.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
      subtotal: q.subtotal,
      discount: q.discount,
      total: q.total,
      toConfirm: agreement?.confirmationAmount ?? q.advanceAmount,
      confirmationPercent: agreement?.confirmationPercent ?? rules.confirmationPercent,
      validUntil: q.validUntil ? istToday(q.validUntil) : null,
      inclusions: q.inclusions,
      exclusions: q.exclusions,
      terms: q.terms,
      sentAt: q.sentAt?.toISOString() ?? null,
      openedAt: q.customerViewedAt?.toISOString() ?? null,
      changesNote: stage === 'CHANGES' ? q.changesRequestNote : null,
      acceptedAt: q.acceptedAt?.toISOString() ?? null,
      hasLink: q.hasCustomerLink,
      booking: agreement ? { holdWindowDays: agreement.holdWindowDays } : null,
    };
  }

  async function state(enquiryId: string): Promise<VenueQuotationState> {
    const e = await enquiry(enquiryId);
    const v = await venue();
    const q = await current(enquiryId);
    const packages = v.vendorId
      ? await deps.db.vendorPackage.findMany({ where: { vendorId: v.vendorId }, select: { name: true, price: true, isPerPlate: true }, orderBy: { price: 'asc' }, take: 20 })
      : [];
    return {
      customer: { name: e.name, phone: e.phone, weddingDate: e.weddingDate || null },
      venueName: v.business.name,
      rules: { confirmationPercent: v.rules.confirmationPercent, holdWindowDays: v.rules.holdWindowDays },
      quotation: q ? await toView(q, v.rules) : null,
      packages: packages.map((p) => ({ name: p.name, price: p.price, perPlate: p.isPerPlate })),
    };
  }

  async function requireCurrent(enquiryId: string, what: string): Promise<QuotationView> {
    await enquiry(enquiryId);
    const q = await current(enquiryId);
    if (!q) throw new ConflictError(`There is no quotation to ${what} yet`);
    return q;
  }

  return {
    get: state,

    // Saves the draft: a new quotation, or the draft already there. A sent quotation is never edited — it is revised.
    async save(enquiryId: string, input: Record<string, unknown>, actorId: string | null): Promise<SaveResult> {
      const e = await enquiry(enquiryId);
      if (e.pipelineStage === 'LOST') throw new ConflictError('This enquiry is closed');
      const checked = validateVenueQuote(input, istToday(deps.now()));
      if (!checked.ok) return { errors: checked.errors };
      const v = await venue();
      const value = checked.value;
      const total = value.items.reduce((sum, l) => sum + lineTotal(l), 0) - value.discount;
      const body = {
        items: value.items,
        discount: value.discount,
        advanceAmount: requiredConfirmation(total, v.rules),
        validUntil: endOfIstDay(value.validUntil),
        inclusions: value.inclusions,
        exclusions: value.exclusions,
        terms: value.terms,
      };
      const q = await current(enquiryId);
      if (q?.status === 'DRAFT') await deps.quotations.update(q.id, body);
      else if (q?.status === 'SENT') throw new ConflictError('This quotation has been sent — revise it to change it');
      else await deps.quotations.create('CONSULTATION', enquiryId, body, actorId);
      // A booking needs a city; a venue's own enquiry has none, and its weddings are at the venue.
      if (!e.city?.trim() && v.city) await deps.db.consultation.update({ where: { id: enquiryId }, data: { city: v.city } });
      return state(enquiryId);
    },

    // Sends the draft and makes the couple's link — one step for the venue.
    async send(enquiryId: string, actorId: string | null): Promise<LinkResult> {
      const q = await requireCurrent(enquiryId, 'send');
      await deps.quotations.send(q.id, actorId);
      const { token } = await deps.quotations.issueCustomerLink(q.id, actorId);
      return { ...(await state(enquiryId)), linkPath: `/proposal/${token}` };
    },

    // A fresh link for the sent quotation (the old one stops working) — for when the first was not shared or was lost.
    async newLink(enquiryId: string, actorId: string | null): Promise<LinkResult> {
      const q = await requireCurrent(enquiryId, 'share');
      const { token } = await deps.quotations.issueCustomerLink(q.id, actorId);
      return { ...(await state(enquiryId)), linkPath: `/proposal/${token}` };
    },

    // A new draft from the sent / expired quotation — its link stops working until the new one is sent.
    async revise(enquiryId: string, actorId: string | null): Promise<VenueQuotationState> {
      const q = await requireCurrent(enquiryId, 'change');
      await deps.quotations.revise(q.id, actorId);
      return state(enquiryId);
    },

    // The couple accepted but the booking could not be made on its own (no wedding date yet): the venue gives the date.
    async book(enquiryId: string, input: { weddingDate?: unknown }, actorId: string | null): Promise<VenueQuotationState> {
      const e = await enquiry(enquiryId);
      const q = await requireCurrent(enquiryId, 'book');
      if (q.status !== 'ACCEPTED') throw new ConflictError('The couple has not accepted this quotation yet');
      const raw = typeof input.weddingDate === 'string' ? input.weddingDate.trim() : '';
      const weddingDate = raw ? resolveSourceDate(raw) : null;
      if (raw && !weddingDate) throw new ValidationError('Pick the wedding date');
      if (!weddingDate && !resolveSourceDate(e.weddingDate)) throw new ValidationError('Pick the wedding date');
      const v = await venue();
      await deps.quotations.createBooking(q.id, { weddingDate: weddingDate ?? undefined, city: e.city?.trim() ? undefined : (v.city ?? undefined) }, actorId);
      if (weddingDate && !e.weddingDate) await deps.db.consultation.update({ where: { id: enquiryId }, data: { weddingDate: raw } });
      return state(enquiryId);
    },
  };
}

export const venueQuotationService = createVenueQuotationService();
