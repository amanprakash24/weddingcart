// The Lead Workspace "journey": one plain-language reading of where a deal is, and the single next thing to do.
//
// Nothing here is new state. It only READS what already exists — the lead's own pipeline stage, the current
// quotation's status, the booking made from it, and whether a Wedding exists — and keeps them as three separate
// facts (decision of 21 Sep 2026): accepting a quotation does NOT move the lead stage, and an accepted quotation is
// not a confirmed booking. Pure and free of server imports so the admin UI and the tests can both use it.
import type { PipelineStage } from '@/generated/prisma/enums';

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'SUPERSEDED';
export type BookingStatus = 'NEW' | 'CONTACTED' | 'CONFIRMED' | 'CLOSED';

export interface JourneyQuotation {
  status: QuoteStatus;
  booking: { status: BookingStatus } | null;
  createdAt: string;
  sentAt?: string | null;
  acceptedAt?: string | null;
  acceptedChannel?: string | null;
}

// The quotation the journey is about: the accepted one if there is one, else the open one (draft or sent), else the
// most recent one that ended (declined / expired). Replaced revisions are history and never "current".
export function pickCurrentQuotation<T extends JourneyQuotation>(quotations: T[] | null | undefined): T | null {
  if (!quotations || quotations.length === 0) return null;
  const accepted = quotations.find((q) => q.status === 'ACCEPTED');
  if (accepted) return accepted;
  const open = quotations.find((q) => q.status === 'DRAFT' || q.status === 'SENT');
  if (open) return open;
  const ended = quotations
    .filter((q) => q.status === 'REJECTED' || q.status === 'EXPIRED')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return ended[0] ?? null;
}

export type JourneyState =
  | 'NO_QUOTE'
  | 'DRAFT'
  | 'SENT'
  | 'LAPSED' // the last quote was declined or expired
  | 'ACCEPTED' // the customer said yes; no booking yet
  | 'BOOKING_PENDING' // a booking exists but is not confirmed
  | 'BOOKING_CONFIRMED' // confirmed — the Wedding exists
  | 'READY_TO_CONVERT' // CRM path: the lead is Booked but its Wedding Workspace is not created yet
  | 'NOT_PROCEEDING'; // the lead is Lost, or its booking was closed

export interface JourneyInput {
  pipelineStage: PipelineStage;
  hasWedding: boolean;
  quotation: JourneyQuotation | null;
}

export function deriveJourney({ pipelineStage, hasWedding, quotation }: JourneyInput): JourneyState {
  if (hasWedding) return 'BOOKING_CONFIRMED';
  if (pipelineStage === 'LOST') return 'NOT_PROCEEDING';
  if (quotation?.booking?.status === 'CLOSED') return 'NOT_PROCEEDING';
  if (pipelineStage === 'WON') return 'READY_TO_CONVERT';
  if (!quotation) return 'NO_QUOTE';
  switch (quotation.status) {
    case 'DRAFT':
      return 'DRAFT';
    case 'SENT':
      return 'SENT';
    case 'ACCEPTED':
      // A booking already marked CONFIRMED with no Wedding yet means the conversion did not finish — confirming again retries it.
      return quotation.booking ? 'BOOKING_PENDING' : 'ACCEPTED';
    default:
      return 'LAPSED';
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The three facts shown side by side in the header
// ---------------------------------------------------------------------------------------------------------------

export type Tone = 'gray' | 'sky' | 'amber' | 'green' | 'slate' | 'dashed';

export interface StatusChip {
  label: string;
  tone: Tone;
}

export function quotationChip(quotation: JourneyQuotation | null, state: JourneyState): StatusChip {
  if (!quotation) return { label: 'No quote yet', tone: 'dashed' };
  switch (quotation.status) {
    case 'DRAFT':
      return { label: 'Draft', tone: 'gray' };
    case 'SENT':
      return { label: 'Sent', tone: 'sky' };
    case 'ACCEPTED':
      return { label: 'Accepted', tone: state === 'BOOKING_CONFIRMED' ? 'green' : state === 'NOT_PROCEEDING' ? 'slate' : 'amber' };
    case 'REJECTED':
      return { label: 'Declined', tone: 'slate' };
    case 'EXPIRED':
      return { label: 'Expired', tone: 'slate' };
    default:
      return { label: 'Replaced', tone: 'gray' };
  }
}

export function bookingChip(quotation: JourneyQuotation | null, state: JourneyState): StatusChip {
  const booking = quotation?.booking ?? null;
  if (state === 'BOOKING_CONFIRMED') return { label: 'Confirmed', tone: 'green' };
  if (!booking) return state === 'NOT_PROCEEDING' ? { label: 'Not proceeding', tone: 'slate' } : { label: 'Not created', tone: 'dashed' };
  if (booking.status === 'CLOSED') return { label: 'Closed', tone: 'slate' };
  if (booking.status === 'CONFIRMED') return { label: 'Confirmed', tone: 'green' };
  return { label: 'Pending', tone: 'amber' };
}

// ---------------------------------------------------------------------------------------------------------------
// The single Next action
// ---------------------------------------------------------------------------------------------------------------

export type NextActionId =
  | 'create-quote'
  | 'finish-quote'
  | 'send-quote'
  | 'follow-up'
  | 'revise-quote'
  | 'create-booking'
  | 'mark-booked'
  | 'confirm-booking'
  | 'manage-wedding'
  | 'create-wedding'
  | 'view-reason';

export type SecondaryActionId = 'customer-accepted' | 'customer-declined' | 'not-proceeding';

export interface NextAction {
  id: NextActionId;
  title: string;
  why: string;
  label: string;
  // Turns the button dark instead of the warm gradient: states where nothing is waiting on the operator.
  quiet: boolean;
  secondary: { id: SecondaryActionId; label: string; danger?: boolean }[];
}

export interface NextActionContext {
  sourceType: 'LEAD' | 'ENQUIRY' | 'CONSULTATION';
  customerName: string;
  canSend: boolean; // the current draft has lines and a future valid-until date
  sentOn: string | null; // "18 Sep 2026" — already formatted
  validUntil: string | null;
  acceptedOn: string | null;
  acceptedVia: string | null; // "WhatsApp"
  weddingNumber: string | null;
  closedReason: string | null;
  followUps: number; // follow-ups already logged this session
}

const NOT_PROCEEDING_LINK = { id: 'not-proceeding', label: 'Not proceeding', danger: true } as const;

export function nextAction(state: JourneyState, c: NextActionContext): NextAction {
  const name = c.customerName;
  switch (state) {
    case 'NO_QUOTE':
      return { id: 'create-quote', title: 'Make a quote', why: `Nothing has been quoted for ${name} yet.`, label: 'Create quote', quiet: false, secondary: [] };
    case 'DRAFT':
      return c.canSend
        ? { id: 'send-quote', title: 'Send the quote', why: 'The quote is ready. This marks it as sent and opens WhatsApp with the message prepared — you press send there.', label: 'Send quote on WhatsApp', quiet: false, secondary: [] }
        : { id: 'finish-quote', title: 'Finish the quote', why: 'Add at least one service and a valid-until date, then it can be sent.', label: 'Edit quote', quiet: false, secondary: [] };
    case 'SENT':
      return {
        id: 'follow-up',
        title: `Follow up with ${name}`,
        why: `${c.sentOn ? `Sent ${c.sentOn}. ` : ''}${c.followUps ? 'You have followed up. ' : 'No reply recorded yet. '}${c.validUntil ? `Valid until ${c.validUntil}.` : ''}`.trim(),
        label: c.followUps ? 'Follow up again on WhatsApp' : 'Follow up on WhatsApp',
        quiet: false,
        secondary: [
          { id: 'customer-accepted', label: 'Customer said yes' },
          { id: 'customer-declined', label: 'Customer declined', danger: true },
        ],
      };
    case 'LAPSED':
      return { id: 'revise-quote', title: 'Revise the quote', why: 'The last quote was declined or has expired. Revising makes a fresh draft from it.', label: 'Revise quote', quiet: false, secondary: [] };
    case 'ACCEPTED':
      if (c.sourceType === 'LEAD') {
        return { id: 'mark-booked', title: 'Mark the lead as booked', why: `${name} accepted${c.acceptedOn ? ` on ${c.acceptedOn}` : ''}. A lead becomes a wedding through the CRM: first mark it Booked.`, label: 'Mark as booked', quiet: false, secondary: [NOT_PROCEEDING_LINK] };
      }
      return {
        id: 'create-booking',
        title: 'Create the booking',
        why: `${name} accepted${c.acceptedOn ? ` on ${c.acceptedOn}` : ''}${c.acceptedVia ? ` via ${c.acceptedVia}` : ''}. This is not a confirmed booking yet.`,
        label: 'Create booking',
        quiet: false,
        secondary: [NOT_PROCEEDING_LINK],
      };
    case 'BOOKING_PENDING':
      return { id: 'confirm-booking', title: 'Confirm the booking', why: 'The booking is waiting for you. Confirming sets up the wedding, and the advance invoice if the quote has an advance.', label: 'Confirm booking', quiet: false, secondary: [NOT_PROCEEDING_LINK] };
    case 'BOOKING_CONFIRMED':
      return { id: 'manage-wedding', title: 'Continue in the wedding', why: `${c.weddingNumber ?? 'The wedding'} is set up. Vendors, tasks and payments are managed there.`, label: 'Manage wedding', quiet: true, secondary: [] };
    case 'READY_TO_CONVERT':
      return { id: 'create-wedding', title: 'Create the wedding workspace', why: 'This lead is Booked. Create its wedding workspace to continue.', label: 'Create wedding workspace', quiet: false, secondary: [] };
    default:
      return { id: 'view-reason', title: 'This deal is closed', why: c.closedReason ?? 'Marked as not proceeding.', label: 'View reason', quiet: true, secondary: [] };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The five-step journey strip
// ---------------------------------------------------------------------------------------------------------------

export type StepStatus = 'done' | 'current' | 'upcoming' | 'ok' | 'stopped';
export interface JourneyStep {
  key: 'enquiry' | 'quote' | 'accepted' | 'booking' | 'wedding';
  label: string;
  status: StepStatus;
  sub: string;
}

export interface StepContext {
  enquiryOn: string | null;
  sentOn: string | null;
  acceptedOn: string | null;
  acceptedVia: string | null;
  weddingNumber: string | null;
}

// Green is reserved for a confirmed booking and its wedding; accepted and pending stay amber/ink.
export function journeySteps(state: JourneyState, quotation: JourneyQuotation | null, c: StepContext): JourneyStep[] {
  const sent = !!quotation && quotation.status !== 'DRAFT' && quotation.status !== 'SUPERSEDED';
  const accepted = quotation?.status === 'ACCEPTED';
  const hasBooking = !!quotation?.booking;
  const acceptedSub = [c.acceptedOn, c.acceptedVia].filter(Boolean).join(' · ');

  const step = (key: JourneyStep['key'], label: string, status: StepStatus, sub = ''): JourneyStep => ({ key, label, status, sub });
  const enquiry = step('enquiry', 'Enquiry', 'done', c.enquiryOn ?? '');

  switch (state) {
    case 'NO_QUOTE':
      return [enquiry, step('quote', 'Quote', 'current', 'Not made yet'), step('accepted', 'Accepted', 'upcoming'), step('booking', 'Booking', 'upcoming'), step('wedding', 'Wedding', 'upcoming')];
    case 'DRAFT':
      return [enquiry, step('quote', 'Quote', 'current', 'Draft'), step('accepted', 'Accepted', 'upcoming'), step('booking', 'Booking', 'upcoming'), step('wedding', 'Wedding', 'upcoming')];
    case 'SENT':
      return [enquiry, step('quote', 'Quote sent', 'done', c.sentOn ? `Sent ${c.sentOn}` : 'Sent'), step('accepted', 'Accepted', 'current', 'Waiting for reply'), step('booking', 'Booking', 'upcoming'), step('wedding', 'Wedding', 'upcoming')];
    case 'LAPSED':
      return [enquiry, step('quote', 'Quote', 'current', quotation?.status === 'REJECTED' ? 'Declined' : 'Expired'), step('accepted', 'Accepted', 'upcoming'), step('booking', 'Booking', 'upcoming'), step('wedding', 'Wedding', 'upcoming')];
    case 'ACCEPTED':
      return [enquiry, step('quote', 'Quote sent', 'done', c.sentOn ? `Sent ${c.sentOn}` : 'Sent'), step('accepted', 'Accepted', 'done', acceptedSub), step('booking', 'Booking', 'current', 'Not created yet'), step('wedding', 'Wedding', 'upcoming')];
    case 'BOOKING_PENDING':
      return [enquiry, step('quote', 'Quote sent', 'done', c.sentOn ? `Sent ${c.sentOn}` : 'Sent'), step('accepted', 'Accepted', 'done', acceptedSub), step('booking', 'Booking', 'current', 'Pending confirmation'), step('wedding', 'Wedding', 'upcoming')];
    case 'BOOKING_CONFIRMED':
      return [
        enquiry,
        step('quote', 'Quote sent', accepted || sent ? 'done' : 'upcoming', c.sentOn ? `Sent ${c.sentOn}` : ''),
        step('accepted', 'Accepted', accepted ? 'done' : 'upcoming', acceptedSub),
        step('booking', 'Booking', 'ok', 'Confirmed'),
        step('wedding', 'Wedding', 'ok', c.weddingNumber ?? ''),
      ];
    case 'READY_TO_CONVERT':
      return [enquiry, step('quote', 'Quote sent', sent ? 'done' : 'upcoming', c.sentOn ? `Sent ${c.sentOn}` : ''), step('accepted', 'Accepted', accepted ? 'done' : 'upcoming', acceptedSub), step('booking', 'Booking', 'current', 'Booked'), step('wedding', 'Wedding', 'upcoming', 'Ready to create')];
    default: {
      // Not proceeding: everything that really happened stays "done"; the first step that did not happen — and every one
      // after it — is shown as stopped. The acceptance, if there was one, is never erased.
      const reached = hasBooking ? 4 : accepted ? 3 : sent ? 2 : 1; // steps 0..reached-1 happened
      const steps = [
        enquiry,
        step('quote', sent ? 'Quote sent' : 'Quote', 'done', sent ? (c.sentOn ? `Sent ${c.sentOn}` : 'Sent') : ''),
        step('accepted', 'Accepted', 'done', acceptedSub),
        step('booking', 'Booking', 'done', 'Created'),
        step('wedding', 'Wedding', 'upcoming'),
      ];
      return steps.map((s, i) => {
        if (i < reached) return s;
        return { ...s, status: 'stopped' as const, sub: i === reached ? 'Not proceeding' : '' };
      });
    }
  }
}
