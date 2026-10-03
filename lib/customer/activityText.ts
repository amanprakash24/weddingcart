// What a couple may see of their wedding's timeline (Customer Portal). Staff-written summaries are NEVER passed through: they can
// carry vendor prices, commission and internal notes ("Payout calculated … commission @ 12%", "Agreed price for X changed …"), all
// logged as STATUS_CHANGED. Instead, an allow-list of event types, each with one fixed, customer-safe sentence. Anything else is
// left out. Pure.

const CUSTOMER_TEXT: Record<string, string> = {
  PAYMENT_RECEIVED: 'Payment received — thank you',
  VENDOR_CONFIRMED: 'A vendor confirmed your booking',
  VENDOR_DECLINED: 'A vendor could not take your booking — your coordinator will update you',
  DOCUMENT_UPLOADED: 'A document was added to your wedding',
};

export function customerActivityText(type: string): string | null {
  return CUSTOMER_TEXT[type] ?? null;
}

export const CUSTOMER_ACTIVITY_TYPES = Object.keys(CUSTOMER_TEXT);
