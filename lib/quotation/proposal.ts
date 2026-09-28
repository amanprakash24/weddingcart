// Wedding Proposal — the couple-facing presentation of a Quotation (docs/wedding-os/08-quotation.md §15).
// Pure: no database. The proposal is NOT a separate model; everything here is derived from the quotation.
import { createHash, randomBytes } from 'node:crypto';
import type { QuotationStatus } from '@/generated/prisma/enums';
import { ValidationError } from '@/lib/errors';
import type { BookingSource } from '@/lib/quotation/booking';

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

export interface CustomerProposal {
  number: string;
  version: number;
  state: ProposalState;
  validUntil: string | null;
  acceptedAt: string | null;
  changesRequested: boolean;
  couple: { name: string | null };
  wedding: { date: string | null; guestCount: number | null; city: string | null; eventType: string | null };
  items: { category: string | null; functionLabel: string | null; description: string; vendorName: string | null; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  gstAmount: number | null; // null when GST is not charged
  total: number;
  advanceAmount: number;
  inclusions: string | null;
  exclusions: string | null;
  terms: string | null;
}

export function toCustomerProposal(
  q: ProposalQuotationInput,
  source: Pick<BookingSource, 'name' | 'city' | 'dateText' | 'guestCount' | 'eventType'> | null,
  vendorNames: Map<string, string>,
  now: Date
): CustomerProposal {
  return {
    number: q.quotationNumber,
    version: q.revision,
    state: proposalState(q, now),
    validUntil: q.validUntil ? q.validUntil.toISOString() : null,
    acceptedAt: q.acceptedAt ? q.acceptedAt.toISOString() : null,
    changesRequested: q.changesRequestedAt !== null,
    couple: { name: source?.name ?? null },
    wedding: {
      date: source?.dateText ?? null,
      guestCount: source?.guestCount ?? null,
      city: source?.city ?? null,
      eventType: source?.eventType ?? null,
    },
    items: [...q.items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => ({
        category: i.category,
        functionLabel: i.functionLabel,
        description: i.description,
        vendorName: i.vendorId ? vendorNames.get(i.vendorId) ?? null : null,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.unitPrice * i.quantity,
      })),
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
