import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { requiredConfirmation, type CommercialRules } from '@/lib/commercial/rules';
import { resolveSourceDate } from '@/lib/quotation/booking';
import { currentBusiness, rulesOf } from '@/lib/ownership/business';
import { effectiveScope } from '@/lib/ownership/scope';
import { can } from '@/lib/auth/permissions';
import { quoteStage, validateVenueQuote, type QuoteStage, type VenueQuoteErrors } from '@/lib/venue/quotation';
import { gstTotals } from '@/lib/quotation/lineGst';
import { validateVenuePayment, type VenuePaymentErrors } from '@/lib/venue/payment';
import { FUNCTION_TYPE_LABELS, functionOfLabel, type FunctionType, type Offering } from '@/lib/venue/offering';
import { quotationService, type QuotationView } from '@/services/quotation.service';
import { loadAgreementMoney, recordAgreementPayment } from '@/services/agreement.service';
import { bookingService } from '@/services/booking.service';
import { convertBookingToWedding } from '@/services/weddingConversion.service';

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
  // lineTotal = how many × price each. taxable = that minus the line's share of the discount; gst = the GST on it (0 without a rate).
  items: { description: string; quantity: number; unitPrice: number; lineTotal: number; function: FunctionType | null; gstRateBp: number | null; taxable: number; gst: number }[];
  subtotal: number;
  discount: number;
  gstAmount: number; // the sum of the lines' GST — 0 when no line carries a rate
  total: number;
  // The top of the document: who it is from. The name and logo are the business profile's (null = not added yet). The GST number is
  // the one FROZEN on this quotation when it was saved (Quotation.sellerGstin) — the profile changing later never changes it.
  letterhead: { name: string; logoUrl: string | null; gstin: string | null };
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
  // After the couple accepts: the booking and its money. null = not made yet (the wedding date is needed).
  booking: VenueBookingMoney | null;
  // true when the booking exists but this member may not see its money (lib/auth/permissions.ts: view_financials) — `booking` is
  // then null, and the screen says the payments are with the owner.
  moneyHidden: boolean;
  // The wedding this booking became (the business's own — /vendor/weddings/[id]). null = not made yet.
  wedding: { id: string; number: string } | null;
  // The booking is confirmed but has no wedding yet (it was confirmed before weddings were made here, or making it failed) —
  // "Create the wedding" is offered.
  canCreateWedding: boolean;
}

// Where the booking stands, from the payments actually recorded (lib/commercial/view.ts) under the agreement's frozen rule.
export interface VenueBookingMoney {
  holdWindowDays: number;
  confirmed: boolean; // the booking is confirmed — the amount to confirm was received
  received: number;
  toConfirmRemaining: number; // still needed to confirm the booking
  outstanding: number; // still to be received of the whole agreed total
  stateLabel: string; // "No payment yet", "Date held — 3 of 5 days left", "Booking confirmed" …
  holdOver: boolean; // a part payment held the date and the hold period has passed
  payments: { id: string; amount: number; method: string; reference: string | null; paidAt: string }[];
  // The invoices of this booking, each with its own tax line: taxable + gst = total. gst is 0 (and gstin null) with no GST charged.
  invoices: { number: string; kind: 'ADVANCE' | 'BALANCE' | 'OTHER'; taxable: number; gst: number; total: number; paid: number; gstin: string | null }[];
}

export interface VenueQuotationState {
  customer: { name: string; phone: string; weddingDate: string | null };
  venueName: string;
  rules: Pick<CommercialRules, 'confirmationPercent' | 'holdWindowDays'>;
  quotation: VenueQuotationView | null;
  // The venue's listing packages, offered as one-tap starting lines for a new quotation.
  packages: { name: string; price: number; perPlate: boolean }[];
  // What the venue offers for each function (its "What we offer" list) — one-tap lines that carry their function.
  offerings: Offering[];
  // Where the venue's own customers pay (Settings, D7) — for the payment details the venue sends them. null = not set.
  payTo: { upiId: string; upiName: string | null } | null;
}

export type SaveResult = VenueQuotationState | { errors: VenueQuoteErrors };
export type PayResult = VenueQuotationState | { errors: VenuePaymentErrors };
// The couple's link is shown ONCE, when it is made — only its hash is stored (services/quotation.service.ts).
export type LinkResult = VenueQuotationState & { linkPath: string };

export interface VenueQuotationDeps {
  db: {
    consultation: Pick<typeof prisma.consultation, 'findUnique' | 'update'>;
    wedding: Pick<typeof prisma.wedding, 'findUnique'>;
    business: Pick<typeof prisma.business, 'findUnique'>;
    vendorPackage: Pick<typeof prisma.vendorPackage, 'findMany'>;
    businessOffering: Pick<typeof prisma.businessOffering, 'findMany'>;
  };
  quotations: Pick<typeof quotationService, 'listForSource' | 'create' | 'update' | 'send' | 'revise' | 'issueCustomerLink' | 'createBooking'>;
  business: typeof currentBusiness;
  // Money v1, unchanged (services/agreement.service.ts): the agreement's money, recording a payment, and the one gate that
  // confirms a booking (services/booking.service.ts — it re-checks the amount itself).
  money: typeof loadAgreementMoney;
  recordPayment: typeof recordAgreementPayment;
  confirmBooking: (bookingId: string) => Promise<unknown>;
  // The existing Booking → Wedding conversion, unchanged (services/weddingConversion.service.ts): one wedding per booking however
  // often it is called, only for a confirmed booking whose amount to confirm was received. Inside the venue's scope the wedding and
  // everything in it belong to the venue's business.
  createWedding: (bookingId: string) => Promise<{ id: string }>;
  now: () => Date;
}

const defaultDeps = (): VenueQuotationDeps => ({
  db: prisma,
  quotations: quotationService,
  business: currentBusiness,
  money: loadAgreementMoney,
  recordPayment: recordAgreementPayment,
  confirmBooking: (bookingId) => bookingService.update(bookingId, { status: 'CONFIRMED' }),
  createWedding: convertBookingToWedding,
  now: () => new Date(),
});

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
    const listing = await deps.db.business.findUnique({ where: { id: business.id }, select: { vendorId: true, logoUrl: true, gstin: true, vendor: { select: { city: true } } } });
    return {
      business,
      rules: rulesOf(business),
      vendorId: listing?.vendorId ?? null,
      city: listing?.vendor?.city?.trim() || null,
      letterhead: { name: business.name, logoUrl: listing?.logoUrl ?? null, gstin: listing?.gstin ?? null },
    };
  }

  async function toView(q: QuotationView, rules: CommercialRules, letterhead: VenueQuotationView['letterhead']): Promise<VenueQuotationView | null> {
    const stage = quoteStage({ status: q.status, changesRequested: q.changesRequestedAt !== null });
    if (!stage) return null;
    // Once accepted and booked, the agreement holds the rule this deal was made with — never today's setting. (No agreement yet =
    // the booking is not made; the figures are then the quotation's own.)
    const money = stage === 'ACCEPTED' ? await deps.money(q.id, deps.now()) : null;
    const agreement = money?.exists ? money : null;
    const seesMoney = can(effectiveScope(), 'view_financials');
    const wedding = agreement?.weddingId ? await deps.db.wedding.findUnique({ where: { id: agreement.weddingId }, select: { id: true, weddingNumber: true } }) : null;
    // The per-line figures are worked out again from the stored lines — the same arithmetic that produced the stored totals.
    const gst = gstTotals(q.items, q.discount);
    return {
      id: q.id,
      number: q.quotationNumber,
      revision: q.revision,
      stage,
      items: q.items.map((i, n) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal, function: functionOfLabel(i.functionLabel), gstRateBp: i.gstRateBp ?? null, taxable: gst.lines[n].taxable, gst: gst.lines[n].gst })),
      subtotal: q.subtotal,
      discount: q.discount,
      gstAmount: q.gstAmount,
      total: q.total,
      letterhead: { ...letterhead, gstin: q.sellerGstin ?? null },
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
      moneyHidden: !!agreement && !seesMoney,
      wedding: wedding ? { id: wedding.id, number: wedding.weddingNumber } : null,
      canCreateWedding: !!agreement && agreement.bookingConfirmed && !wedding && can(effectiveScope(), 'weddings'),
      booking: agreement && seesMoney
        ? {
            holdWindowDays: agreement.holdWindowDays,
            confirmed: agreement.bookingConfirmed,
            received: agreement.received,
            toConfirmRemaining: agreement.remaining,
            outstanding: agreement.outstanding,
            stateLabel: agreement.stateLabel,
            holdOver: agreement.overdue && !agreement.bookingConfirmed,
            payments: agreement.payments.map((p) => ({ id: p.id, amount: p.amount, method: p.method, reference: p.reference, paidAt: p.paidAt })),
            invoices: agreement.invoices.map((i) => ({ number: i.invoiceNumber, kind: i.kind, taxable: i.taxable, gst: i.gst, total: i.total, paid: i.paid, gstin: i.sellerGstin })),
          }
        : null,
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
      quotation: q ? await toView(q, v.rules, v.letterhead) : null,
      packages: packages.map((p) => ({ name: p.name, price: p.price, perPlate: p.isPerPlate })),
      // Not an owned table: the business is named here, from the scope (services/venueOffering.service.ts).
      offerings: await deps.db.businessOffering.findMany({ where: { businessId: v.business.id }, select: { id: true, function: true, name: true, price: true, perPlate: true }, orderBy: [{ function: 'asc' }, { createdAt: 'asc' }] }),
      payTo: v.business.upiId && can(effectiveScope(), 'view_financials') ? { upiId: v.business.upiId, upiName: v.business.upiName } : null,
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
      const money = gstTotals(value.items, value.discount);
      // A document that charges GST must carry the seller's GST number (founder's rule, 5 Oct 2026) — asked for here, once.
      if (money.hasGst && !v.letterhead.gstin) return { errors: { gst: 'Add your GST number in your business profile before charging GST on a quotation' } };
      const body = {
        items: value.items.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, functionLabel: l.function ? FUNCTION_TYPE_LABELS[l.function] : null, gstRateBp: l.gstRateBp })),
        discount: value.discount,
        gstEnabled: money.gst > 0,
        gstAmount: money.gst,
        // Frozen on the quotation (founder, 7 Oct 2026): the GST number as it is in the business profile at this save. The
        // document, the couple's link and its invoices read it from the quotation from here on — never from the profile again.
        sellerGstin: v.letterhead.gstin,
        // What confirms the booking is the venue's rule on the WHOLE total, GST included.
        advanceAmount: requiredConfirmation(money.total, v.rules),
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

    // Money received from the venue's own customer — cash, UPI, bank transfer or cheque. A part payment holds the date for the
    // agreement's hold days; once the amount to confirm is in, the booking is confirmed (anything above it goes to the balance).
    // The payment is its own transaction: it is never undone because the confirmation that follows could not be completed.
    // A confirmed booking becomes the venue's own wedding straight away (createWedding) — also its own step: a wedding that could
    // not be made never undoes the payment or the confirmation, and "Create the wedding" on the enquiry is the retry.
    async pay(enquiryId: string, input: Record<string, unknown>, actorId: string | null): Promise<PayResult> {
      const q = await requireCurrent(enquiryId, 'take a payment for');
      if (q.status !== 'ACCEPTED') throw new ConflictError('The couple has not accepted this quotation yet');
      const before = await deps.money(q.id, deps.now());
      if (!before.exists || !before.bookingId) throw new ConflictError('Make the booking first — then record the payment');
      const checked = validateVenuePayment(input, istToday(deps.now()));
      if (!checked.ok) return { errors: checked.errors };
      const p = checked.value;
      const key = typeof input.idempotencyKey === 'string' && /^[\w-]{8,64}$/.test(input.idempotencyKey) ? input.idempotencyKey : null;
      await deps.recordPayment(q.id, { amount: p.amount, method: p.method, reference: p.reference, paidAt: p.paidOn ? new Date(`${p.paidOn}T12:00:00+05:30`) : null, idempotencyKey: key }, actorId);
      const after = await deps.money(q.id, deps.now());
      if (after.readyToConfirm && after.bookingId) {
        try {
          await deps.confirmBooking(after.bookingId);
        } catch (err) {
          console.error(`venue payment: booking for ${q.quotationNumber} not confirmed —`, err instanceof Error ? err.message : err);
          return state(enquiryId);
        }
        try {
          await deps.createWedding(after.bookingId);
        } catch (err) {
          console.error(`venue payment: wedding for ${q.quotationNumber} not created —`, err instanceof Error ? err.message : err);
        }
      }
      return state(enquiryId);
    },

    // "Create the wedding" — for a confirmed booking that has none yet. Safe to press twice: the conversion returns the wedding
    // that already exists. A booking whose amount to confirm has arrived but was never confirmed is confirmed first (the booking
    // gate re-checks the amount itself).
    async createWedding(enquiryId: string): Promise<VenueQuotationState> {
      const q = await requireCurrent(enquiryId, 'create the wedding for');
      if (q.status !== 'ACCEPTED') throw new ConflictError('The couple has not accepted this quotation yet');
      const money = await deps.money(q.id, deps.now());
      if (!money.exists || !money.bookingId) throw new ConflictError('Make the booking first — then the wedding can be created');
      if (!money.bookingConfirmed && !money.readyToConfirm) throw new ConflictError('The booking is not confirmed yet — record the payment that confirms it first');
      if (!money.weddingId) {
        await deps.confirmBooking(money.bookingId);
        await deps.createWedding(money.bookingId);
      }
      return state(enquiryId);
    },
  };
}

export const venueQuotationService = createVenueQuotationService();
