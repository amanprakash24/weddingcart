// Wedding Proposal — the couple-facing presentation of a Quotation (docs/wedding-os/08-quotation.md §15).
// Pure: no database. The proposal is NOT a separate model; everything here is derived from the quotation.
import { createHash, randomBytes } from 'node:crypto';
import type { QuotationStatus } from '@/generated/prisma/enums';
import { ValidationError } from '@/lib/errors';
import type { BookingSource } from '@/lib/quotation/booking';
import { serviceLabel } from '@/lib/serviceLabels';

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
  items: { sortOrder: number; description: string; category: string | null; functionLabel: string | null; vendorId: string | null; unitPrice: number; quantity: number }[];
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
  items: { service: string | null; functionLabel: string | null; description: string; vendor: ProposalVendor | null; quantity: number; unitPrice: number; lineTotal: number }[];
  confirmedVendors: { name: string; category: string; function: string; date: string; venueName: string | null }[];
  subtotal: number;
  discount: number;
  gstAmount: number | null; // null when GST is not charged
  total: number;
  advanceAmount: number;
  inclusions: string | null;
  exclusions: string | null;
  terms: string | null;
}

const ABOUT_MAX = 280;
const FEATURES_MAX = 6;

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
  const items = [...q.items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => {
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
  };
}
