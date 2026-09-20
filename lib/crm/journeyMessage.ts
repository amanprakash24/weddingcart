// Which customer message goes with which moment of the journey, and how it reaches WhatsApp.
//
// V1 never sends anything itself: the operator opens WhatsApp with the message prepared and presses send there.
// Pure, so it can be tested. The wording lives in lib/quotation/message.ts.
import type { JourneyState } from '@/lib/crm/leadJourney';
import {
  buildAcceptanceThanks,
  buildBookingConfirmedMessage,
  buildFollowUpMessage,
  buildQuotationMessage,
  type QuotationMessageInput,
} from '@/lib/quotation/message';

// A wa.me link to the CUSTOMER (never a venue, never Shaadi Shopping's own number as the recipient). Only a plausible
// 10-digit Indian mobile number produces a link; anything else returns null and the UI offers "Copy message" instead.
export function whatsappUrl(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `https://wa.me/91${digits}?text=${encodeURIComponent(text)}` : null;
}

export interface JourneyMessage {
  kind: 'quote' | 'follow-up' | 'thanks' | 'confirmed';
  label: string; // "Quote message"
  text: string;
  cta: string; // "Send quote on WhatsApp"
  hint: string; // one calm line under the preview
}

export interface JourneyMessageInput {
  quotation: (QuotationMessageInput & { advanceAmount: number }) | null;
  customerName: string | null;
  eventDate: string | null; // words, already validated — or null
  sentOn: string | null;
  weddingNumber: string | null;
}

export function journeyMessage(state: JourneyState, i: JourneyMessageInput): JourneyMessage | null {
  const q = i.quotation;
  switch (state) {
    case 'DRAFT':
      if (!q) return null;
      return {
        kind: 'quote',
        label: 'Quote message',
        text: buildQuotationMessage(q, i.customerName, { eventDate: i.eventDate }),
        cta: 'Send quote on WhatsApp',
        hint: 'Ready to send. This only opens WhatsApp — you press send there.',
      };
    case 'SENT':
      if (!q) return null;
      return {
        kind: 'follow-up',
        label: 'Follow-up message',
        text: buildFollowUpMessage(q, i.customerName, i.sentOn),
        cta: 'Send follow-up on WhatsApp',
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
