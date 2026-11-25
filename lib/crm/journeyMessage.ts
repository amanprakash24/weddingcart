// Which customer message goes with which moment of the journey, and how it reaches WhatsApp.
//
// V1 never sends anything itself: the operator opens WhatsApp with the message prepared and presses send there.
// Pure, so it can be tested. The wording lives in lib/quotation/message.ts.
import type { JourneyState } from '@/lib/crm/leadJourney';
import { whatsappSafeText } from '@/lib/whatsappText';
import {
  buildAcceptanceThanks,
  buildBookingConfirmedMessage,
  buildFollowUpMessage,
  buildQuotationShareMessage,
  type QuotationMessageInput,
} from '@/lib/quotation/message';

// A wa.me link to the CUSTOMER (never a venue, never Shaadi Shopping's own number as the recipient). Only a plausible
// 10-digit Indian mobile number produces a link; anything else returns null and the UI offers "Copy message" instead.
export function whatsappUrl(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `https://wa.me/91${digits}?text=${encodeURIComponent(whatsappSafeText(text))}` : null;
}

export interface JourneyMessage {
  kind: 'quote' | 'follow-up' | 'thanks' | 'confirmed';
  label: string; // "Quote message"
  text: string;
  cta: string; // "Open WhatsApp with the quote"
  hint: string; // one calm line under the preview
}

export interface JourneyMessageInput {
  quotation: (QuotationMessageInput & { advanceAmount: number }) | null;
  customerName: string | null;
  eventDate: string | null; // words, already validated — or null
  sentOn: string | null;
  weddingNumber: string | null;
  // The client link made by "Share on WhatsApp" (only known in this browser tab — the server keeps just its hash).
  shareUrl?: string | null;
}

// Shown in the preview before the link exists: it is created when staff press "Share quotation on WhatsApp".
export const LINK_PLACEHOLDER = '[the quotation link is added when you share]';

export function journeyMessage(state: JourneyState, i: JourneyMessageInput): JourneyMessage | null {
  const q = i.quotation;
  switch (state) {
    case 'DRAFT':
    case 'READY_TO_SHARE':
      if (!q) return null;
      return {
        kind: 'quote',
        label: 'Quote message',
        text: buildQuotationShareMessage({ customerName: i.customerName, eventDate: i.eventDate, quotationNumber: q.quotationNumber, url: i.shareUrl || LINK_PLACEHOLDER }),
        cta: state === 'DRAFT' ? 'Share quotation on WhatsApp' : 'Open WhatsApp again (new link)',
        hint:
          state === 'DRAFT'
            ? "Creates the client's quotation link, then opens WhatsApp with this message. Nothing is marked as sent until you confirm."
            : 'Waiting for you to confirm the message was sent. Opening WhatsApp again makes a new link; the earlier one stops working.',
      };
    case 'SENT':
      if (!q) return null;
      return {
        kind: 'follow-up',
        label: 'Follow-up message',
        text: buildFollowUpMessage(q, i.customerName, i.sentOn),
        cta: 'Open WhatsApp with the follow-up',
        hint: `The quote itself went out${i.sentOn ? ` on ${i.sentOn}` : ''}. A friendly nudge, no pressure.`,
      };
    case 'ACCEPTED':
    case 'BOOKING_PENDING':
      if (!q) return null;
      return {
        kind: 'thanks',
        label: 'Thank-you message',
        text: buildAcceptanceThanks(q, i.customerName),
        cta: 'Send thank-you on WhatsApp',
        hint: 'Optional — lets the customer know what happens next.',
      };
    case 'BOOKING_CONFIRMED':
      return {
        kind: 'confirmed',
        label: 'Confirmation message',
        text: buildBookingConfirmedMessage(i.customerName, i.weddingNumber, i.eventDate),
        cta: 'Send confirmation on WhatsApp',
        hint: 'Optional — tell them the booking is confirmed.',
      };
    default:
      return null;
  }
}
