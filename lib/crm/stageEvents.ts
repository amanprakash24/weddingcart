// The lead's pipeline stage follows the commercial facts. Nothing here is a manual move — those are in pipeline.ts.
//
//   quotation sent            → Quotation Sent
//   quotation revised         → Negotiation   (the customer is talking price)
//   customer acceptance       → Accepted — booking pending
//   booking confirmed         → Booked
//
// Pure and free of server imports. Rules:
//   • it only ever moves a lead FORWARD along that path;
//   • Lost is final and Booked is final — a later quotation event never changes them;
//   • a lead whose stage lagged behind reality (e.g. still "New" although a quotation was sent — how every lead behaved
//     before this change) is caught up by the next event rather than being refused.
import type { PipelineStage } from '@/generated/prisma/enums';

export type CommercialEvent = 'QUOTE_SENT' | 'QUOTE_REVISED' | 'QUOTE_ACCEPTED' | 'BOOKING_CONFIRMED';

const EARLY: readonly PipelineStage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT_SCHEDULED'];

export function stageAfterEvent(current: PipelineStage, event: CommercialEvent): PipelineStage | null {
  if (current === 'LOST' || current === 'WON') return null;
  const early = EARLY.includes(current) || current === 'ON_HOLD'; // a paused lead resumes when real commercial activity happens
  switch (event) {
    case 'QUOTE_SENT':
      return early ? 'QUOTATION_SENT' : null;
    case 'QUOTE_REVISED':
      return early || current === 'QUOTATION_SENT' ? 'NEGOTIATION' : null;
    case 'QUOTE_ACCEPTED':
      return early || current === 'QUOTATION_SENT' || current === 'NEGOTIATION' ? 'ACCEPTED' : null;
    case 'BOOKING_CONFIRMED':
      return 'WON'; // from Accepted normally; from any active stage when the booking was created without going through acceptance
  }
}

export const EVENT_REASON: Record<CommercialEvent, string> = {
  QUOTE_SENT: 'a quotation was sent',
  QUOTE_REVISED: 'the quotation was revised',
  QUOTE_ACCEPTED: 'the customer accepted a quotation',
  BOOKING_CONFIRMED: 'the booking was confirmed',
};
