// Money a venue received from its OWN customer for an accepted quotation (Phase C). The venue records what arrived — cash, UPI,
// bank transfer or cheque; nothing is charged and no payment provider is called. How it counts (the amount that confirms the
// booking, the days a part payment holds the date) is the rule frozen in the agreement — lib/commercial/rules.ts.
// Pure and client-safe: the form and the server share these rules.

export const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = { CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'Bank transfer', CHEQUE: 'Cheque' };

export const REFERENCE_MAX = 120;

export interface VenuePaymentInput {
  amount: number; // whole rupees
  method: PaymentMethod;
  reference: string | null; // UPI / bank reference, cheque number
  paidOn: string | null; // YYYY-MM-DD (India) — null = now
}

export type VenuePaymentErrors = Partial<Record<'amount' | 'method' | 'reference' | 'paidOn', string>>;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

// Returns the clean payment, or one error per box. Whether the amount fits what is still owed is the server's check
// (lib/commercial/agreement.ts) — it knows what has been received.
export function validateVenuePayment(input: Record<string, unknown>, today: string): { ok: true; value: VenuePaymentInput } | { ok: false; errors: VenuePaymentErrors } {
  const errors: VenuePaymentErrors = {};

  const amountRaw = str(input.amount).replace(/[₹,\s]/g, '');
  const amount = /^\d{1,10}$/.test(amountRaw) ? Number(amountRaw) : 0;
  if (amount < 1) errors.amount = 'Enter the amount received, in whole rupees';

  const method = (PAYMENT_METHODS as readonly string[]).includes(input.method as string) ? (input.method as PaymentMethod) : null;
  if (!method) errors.method = 'Choose how the payment was received';

  const reference = str(input.reference);
  if (reference.length > REFERENCE_MAX) errors.reference = `Please keep the reference under ${REFERENCE_MAX} characters`;

  const paidOn = str(input.paidOn);
  if (paidOn && (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || Number.isNaN(new Date(`${paidOn}T12:00:00+05:30`).getTime()))) errors.paidOn = 'Pick the date the payment was received';
  else if (paidOn > today) errors.paidOn = 'The date cannot be in the future';

  if (Object.keys(errors).length || !method) return { ok: false, errors };
  return { ok: true, value: { amount, method, reference: reference || null, paidOn: paidOn && paidOn !== today ? paidOn : null } };
}

// What the venue sends its customer on WhatsApp after they accept: how much confirms the booking and where to pay. The venue's own
// words to its own customer; the UPI details appear only if the venue set them in Settings.
export function paymentRequestMessage(input: { customerName: string; venueName: string; number: string; amount: number; confirmsBooking: boolean; upiId: string | null; upiName: string | null }): string {
  const first = input.customerName.split(' ')[0];
  const amount = `₹${input.amount.toLocaleString('en-IN')}`;
  const lines = [
    `Namaste ${first},`,
    input.confirmsBooking ? `Thank you for accepting quotation ${input.number} from ${input.venueName}. ${amount} confirms your booking.` : `The balance for your booking with ${input.venueName} (${input.number}) is ${amount}.`,
  ];
  if (input.upiId) lines.push(`You can pay by UPI to ${input.upiId}${input.upiName ? ` (${input.upiName})` : ''}.`);
  lines.push('Please share the payment reference once done.');
  return lines.join('\n');
}
