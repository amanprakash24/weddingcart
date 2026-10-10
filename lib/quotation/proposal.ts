// Wedding Proposal — the couple-facing presentation of a Quotation (docs/wedding-os/08-quotation.md §15).
// Pure: no database. The proposal is NOT a separate model; everything here is derived from the quotation.
import { createHash, randomBytes } from 'node:crypto';
import type { CoupleBooking } from '@/lib/quotation/coupleBooking';
import type { QuotationStatus } from '@/generated/prisma/enums';
import { ValidationError } from '@/lib/errors';
import type { BookingSource } from '@/lib/quotation/booking';
import { serviceLabel } from '@/lib/serviceLabels';
import { gstPercentText, gstTotals } from '@/lib/quotation/lineGst';
import type { ProposalPayments } from '@/lib/payments/customerPayment';
import type { ProposalReviews } from '@/lib/reviews/reviewView';
import { FUNCTION_TYPE_LABELS, groupOfferings, isFunctionType, offeringPriceWords, type FunctionType, type Offering, type OfferingInput } from '@/lib/venue/offering';

// ---- the secret link ----

// 32 random bytes → 43 URL-safe characters (256 bits). Unrelated to the quotation id or number.
export function newCustomerToken(): string {
  return randomBytes(32).toString('base64url');
}

// Only this hash is stored (Quotation.customerTokenHash). A leaked database row does not reveal a working link.
export function hashCustomerToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Cheap shape check before any database lookup — anything else is simply "not valid".
export function isWellFormedToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}

// Link-preview and crawler fetches (a pasted link is fetched by WhatsApp, Facebook, Telegram, Slack …) are not the
// couple opening the proposal, so they don't set "first viewed".
export function isPreviewBot(userAgent: string | null | undefined): boolean {
  return /whatsapp|facebookexternalhit|facebot|telegrambot|twitterbot|slackbot|discordbot|linkedinbot|skypeuripreview|googlebot|bingbot|applebot|embedly|bot\b|crawler|spider|preview/i.test(userAgent ?? '');
}

export function proposalUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/proposal/${token}`;
}

// ---- what the couple may do ----

// OPEN: view + accept + request changes. EXPIRED / ACCEPTED: view a read-only state. INVALID: the generic
// "this link is no longer valid" page (draft, superseded, rejected, revoked …) — it never says which.
export type ProposalState = 'OPEN' | 'EXPIRED' | 'ACCEPTED' | 'INVALID';

export function proposalState(q: { status: QuotationStatus; validUntil: Date | null }, now: Date): ProposalState {
  if (q.status === 'ACCEPTED') return 'ACCEPTED';
  if (q.status === 'EXPIRED') return 'EXPIRED';
  if (q.status === 'SENT') {
    if (!q.validUntil || q.validUntil.getTime() <= now.getTime()) return 'EXPIRED';
    return 'OPEN';
  }
  return 'INVALID';
}

// Staff may issue a (new) link while the quotation is open, and after acceptance — the link then carries payments (§20) and
// reviews (§21). Never for a draft, rejected, superseded or expired one.
export const canIssueCustomerLink = (state: ProposalState) => state === 'OPEN' || state === 'ACCEPTED';

export const CHANGE_NOTE_MAX = 1000;

export function validateChangeNote(note: unknown): string {
  const text = typeof note === 'string' ? note.trim() : '';
  if (!text) throw new ValidationError('Tell us what you would like to change');
  if (text.length > CHANGE_NOTE_MAX) throw new ValidationError(`Please keep it under ${CHANGE_NOTE_MAX} characters`);
  return text;
}

// A second request adds to the first instead of replacing it, so nothing the couple wrote is lost.
export function appendChangeNote(existing: string | null, note: string, at: Date): string {
  const stamped = `[${at.toISOString().slice(0, 10)}] ${note}`;
  return existing ? `${existing}\n\n${stamped}` : stamped;
}

// ---- "Add an event" (a venue's own quotation only) ----
// The couple picks a function the venue offers (Haldi, Reception …) and, if they like, what they want for it from the venue's
// "What we offer" list. It is recorded exactly like "Request changes" (decision D3): the quotation is not touched; the venue
// answers with a new version.

export const ADD_EVENT_LIMITS = { maxPicks: 12, noteMax: 500 } as const;

export interface EventRequest {
  function: FunctionType;
  offeringIds: string[];
  note: string | null;
}

export function validateEventRequest(input: unknown): EventRequest {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  if (!isFunctionType(body.function)) throw new ValidationError('Choose the function you would like to add');
  const ids = Array.isArray(body.offeringIds) ? [...new Set(body.offeringIds.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64))] : [];
  if (ids.length > ADD_EVENT_LIMITS.maxPicks) throw new ValidationError(`Please choose up to ${ADD_EVENT_LIMITS.maxPicks}`);
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (note.length > ADD_EVENT_LIMITS.noteMax) throw new ValidationError(`Please keep it under ${ADD_EVENT_LIMITS.noteMax} characters`);
  return { function: body.function, offeringIds: ids, note: note || null };
}

// The sentence the venue reads. Names and prices come from the venue's own list on the server — never from the request.
export function eventRequestNote(fn: FunctionType, picked: Pick<OfferingInput, 'name' | 'price' | 'perPlate'>[], note: string | null): string {
  const label = FUNCTION_TYPE_LABELS[fn];
  const wanted = picked.length ? `Please add ${label}: ${picked.map((o) => `${o.name} (from ${offeringPriceWords(o)})`).join(', ')}.` : `Please add ${label}.`;
  return note ? `${wanted}\n${note}` : wanted;
}

// ---- the couple's view (an explicit allow-list — nothing else ever leaves the server) ----

export interface ProposalQuotationInput {
  quotationNumber: string;
  revision: number;
  status: QuotationStatus;
  validUntil: Date | null;
  acceptedAt: Date | null;
  changesRequestedAt: Date | null;
  subtotal: number;
  discount: number;
  gstEnabled: boolean;
  gstAmount: number;
  total: number;
  advanceAmount: number;
  terms: string | null;
  inclusions: string | null;
  exclusions: string | null;
  items: { sortOrder: number; description: string; category: string | null; functionLabel: string | null; vendorId: string | null; unitPrice: number; quantity: number; gstRateBp?: number | null }[];
}

// A linked vendor's PUBLIC profile — only what already shows on their public page on the site (Step 7, §16). Never the
// owner's name/phone/email, bank details or anything commercial.
export interface ProposalVendorInput {
  name: string;
  slug: string;
  status: string; // only PUBLISHED vendors show profile details; others show their name only
  city: string;
  area: string | null;
  category: string;
  image: string;
  images: string[]; // the public gallery on the vendor's page
  virtualTourVideo: string; // the public video on the vendor's page ('' = none)
  description: string;
  features: string[];
  guestCapacity: number | null;
  venueType: string | null;
  rating: number;
  reviewCount: number;
}

export interface ProposalVendor {
  name: string;
  profile: {
    category: string;
    location: string | null;
    image: string | null;
    gallery: string[]; // up to GALLERY_MAX more public photos (https only, the main image not repeated)
    video: string | null; // https only
    about: string | null;
    features: string[];
    guestCapacity: number | null; // venues only
    venueType: string | null; // venues only
    rating: { value: number; reviews: number } | null; // only when there are reviews
    url: string; // the vendor's public page
  } | null;
}

// A vendor booking on the wedding made from this (accepted) quotation — CONFIRMED only, never a price.
export interface ConfirmedVendorInput {
  vendorName: string;
  category: string;
  eventType: string;
  eventLabel: string | null;
  date: Date;
  venueName: string | null;
}

export interface CustomerProposal {
  number: string;
  version: number;
  state: ProposalState;
  validUntil: string | null;
  acceptedAt: string | null;
  changesRequested: boolean;
  booked: boolean; // the booking made from this proposal is confirmed
  couple: { name: string | null };
  wedding: { date: string | null; guestCount: number | null; city: string | null; eventType: string | null };
  venueName: string | null; // only when exactly one venue line names a vendor
  items: { service: string | null; functionLabel: string | null; description: string; vendor: ProposalVendor | null; quantity: number; unitPrice: number; lineTotal: number; gstPercent: string | null; gst: number; taxable: number }[]; // gstPercent: the line's own rate as typed ("18"), null = no GST on it
  confirmedVendors: { name: string; category: string; function: string; date: string; venueName: string | null }[];
  subtotal: number;
  discount: number;
  gstAmount: number | null; // null when GST is not charged
  total: number;
  advanceAmount: number;
  inclusions: string | null;
  exclusions: string | null;
  terms: string | null;
  // Roadmap 1.3 (§20): only once the couple has accepted — totals, receipts, their own "I have paid" claims, and the UPI payee.
  payments: ProposalPayments | null;
  // Roadmap 1.4 (§21): only once the wedding made from this proposal is COMPLETED — the vendors they booked, to review.
  reviews: ProposalReviews | null;
  // Who the couple sees (D8): Shaadi Shopping, or the venue whose own quotation this is (lib/ownership/business.ts).
  brand: { name: string; phone: string | null; isPlatform: boolean; logoUrl?: string | null; gstin?: string | null };
  // "Add an event": what the venue offers, function by function — only on a venue's own OPEN proposal, otherwise empty.
  // `id` is the row in the venue's own price list; it only says which ones the couple ticked.
  addable: { function: FunctionType; label: string; items: { id: string; name: string; price: string }[] }[];
  // A business's OWN quotation, once its booking is made: where the booking stands, the money, and the wedding it became
  // (lib/quotation/coupleBooking.ts). null on Shaadi Shopping's links (they have `payments`) and before the booking exists.
  yourBooking: CoupleBooking | null;
}

export function toAddable(offerings: Offering[]): CustomerProposal['addable'] {
  return groupOfferings(offerings).map((g) => ({ function: g.function, label: g.label, items: g.items.map((o) => ({ id: o.id, name: o.name, price: offeringPriceWords(o) })) }));
}

const ABOUT_MAX = 280;
const FEATURES_MAX = 6;
const GALLERY_MAX = 6;

const httpsUrl = (value: string | null | undefined) => {
  const t = (value ?? '').trim();
  return /^https:\/\/\S+$/i.test(t) ? t : null;
};

function shorten(text: string, max: number): string | null {
  const t = text.trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trimEnd()}…`;
}

const isVenueCategory = (value: string | null | undefined) => /^venues?$/i.test((value ?? '').trim());

export function toProposalVendor(v: ProposalVendorInput): ProposalVendor {
  if (v.status !== 'PUBLISHED') return { name: v.name, profile: null };
  const venue = isVenueCategory(v.category);
  return {
    name: v.name,
    profile: {
      category: v.category,
      location: [v.area, v.city].filter((x) => x && x.trim()).join(', ') || null,
      image: v.image?.trim() || null,
      gallery: [...new Set((v.images ?? []).map(httpsUrl).filter((u): u is string => !!u && u !== v.image?.trim()))].slice(0, GALLERY_MAX),
      video: httpsUrl(v.virtualTourVideo),
      about: shorten(v.description ?? '', ABOUT_MAX),
      features: (v.features ?? []).map((f) => f.trim()).filter(Boolean).slice(0, FEATURES_MAX),
      guestCapacity: venue ? v.guestCapacity : null,
      venueType: venue ? v.venueType : null,
      rating: v.reviewCount > 0 ? { value: v.rating, reviews: v.reviewCount } : null,
      url: `/vendors/${v.slug}`,
    },
  };
}

export function toCustomerProposal(
  q: ProposalQuotationInput,
  source: Pick<BookingSource, 'name' | 'city' | 'dateText' | 'guestCount' | 'eventType'> | null,
  vendors: Map<string, ProposalVendorInput>,
  now: Date,
  after: { booked: boolean; confirmedVendors: ConfirmedVendorInput[] } = { booked: false, confirmedVendors: [] }
): CustomerProposal {
  // GST line by line (lib/quotation/lineGst.ts) — the same arithmetic that produced the stored GST total.
  const sorted = [...q.items].sort((a, b) => a.sortOrder - b.sortOrder);
  const gst = gstTotals(sorted, q.discount);
  const items = sorted
    .map((i, n) => {
      const v = i.vendorId ? vendors.get(i.vendorId) : undefined;
      return {
        // Older lines stored the raw service key ("venue") — shown by its name ("Venue"); stored data is unchanged.
        service: serviceLabel(i.category),
        functionLabel: i.functionLabel,
        description: serviceLabel(i.description) ?? i.description,
        vendor: v ? toProposalVendor(v) : null,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.unitPrice * i.quantity,
        gstPercent: i.gstRateBp ? gstPercentText(i.gstRateBp) : null,
        gst: gst.lines[n].gst,
        taxable: gst.lines[n].taxable, // the line after its share of the discount — what its GST is worked out on
      };
    });
  // A venue line: its service is "Venue", or its linked vendor is in the Venues category.
  const venueNames = [
    ...new Set(
      q.items
        .map((i) => ({ service: serviceLabel(i.category), v: i.vendorId ? vendors.get(i.vendorId) : undefined }))
        .filter((x) => x.v && (isVenueCategory(x.service) || isVenueCategory(x.v.category)))
        .map((x) => x.v!.name)
    ),
  ];
  const state = proposalState(q, now);
  return {
    number: q.quotationNumber,
    version: q.revision,
    state,
    validUntil: q.validUntil ? q.validUntil.toISOString() : null,
    acceptedAt: q.acceptedAt ? q.acceptedAt.toISOString() : null,
    changesRequested: q.changesRequestedAt !== null,
    booked: state === 'ACCEPTED' && after.booked,
    couple: { name: source?.name ?? null },
    wedding: {
      date: source?.dateText ?? null,
      guestCount: source?.guestCount ?? null,
      city: source?.city ?? null,
      eventType: source?.eventType ?? null,
    },
    venueName: venueNames.length === 1 ? venueNames[0] : null,
    items,
    confirmedVendors:
      state === 'ACCEPTED'
        ? [...after.confirmedVendors]
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map((c) => ({ name: c.vendorName, category: c.category, function: c.eventLabel || c.eventType, date: c.date.toISOString(), venueName: c.venueName }))
        : [],
    subtotal: q.subtotal,
    discount: q.discount,
    gstAmount: q.gstEnabled ? q.gstAmount : null,
    total: q.total,
    advanceAmount: q.advanceAmount,
    inclusions: q.inclusions,
    exclusions: q.exclusions,
    terms: q.terms,
    payments: null, // added by proposal.service for an accepted proposal
    reviews: null, // added by proposal.service once the wedding is completed
    brand: { name: 'Shaadi Shopping', phone: null, isPlatform: true }, // proposal.service sets the owning business's
    addable: [], // proposal.service fills it for a venue's own open proposal
    yourBooking: null, // proposal.service fills it for a business's own accepted proposal, once the booking is made
  };
}
