// The WhatsApp messages around "I have paid" on a business's own proposal link (docs/wedding-os/04-vendor-os.md §18). Nothing is
// sent by the app: each is the text of a wa.me link the person taps and sends from their own WhatsApp — the couple to the
// business's own number, the business to its own customer. Pure and dependency-free (the proposal page imports it).

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const first = (name: string) => name.trim().split(/\s+/)[0] || 'there';

// The couple, straight after "I have paid": tells the business there is something to check.
export function couplePaidMessage(c: { businessName: string; coupleName: string | null; number: string; amount: number; utr: string }): string {
  return [
    `Namaste ${c.businessName},`,
    `I have paid ${inr(c.amount)} by UPI for quotation ${c.number}.`,
    `UPI reference (UTR): ${c.utr}`,
    'Please check and confirm it.',
    ...(c.coupleName?.trim() ? [`— ${c.coupleName.trim()}`] : []),
  ].join('\n');
}

// The business, after it found the money.
export function claimReceivedMessage(c: { customerName: string; businessName: string; number: string; amount: number; confirmed: boolean }): string {
  return [
    `Namaste ${first(c.customerName)} ji,`,
    `We have received your payment of ${inr(c.amount)} for quotation ${c.number}. Thank you!`,
    c.confirmed ? 'Your booking is confirmed.' : 'It is recorded against your booking.',
    'You can see it on your quotation link.',
    `— ${c.businessName}`,
  ].join('\n');
}

// The business, when it could not find the money. The reason is the one the couple also reads on their link.
export function claimNotReceivedMessage(c: { customerName: string; businessName: string; number: string; amount: number; utr: string; reason: string | null }): string {
  return [
    `Namaste ${first(c.customerName)} ji,`,
    `We could not find your payment of ${inr(c.amount)} (UTR ${c.utr}) for quotation ${c.number}.`,
    ...(c.reason?.trim() ? [c.reason.trim().replace(/\.*$/, '.')] : []),
    'Please check the reference in your UPI app and send it again on your quotation link, or call us.',
    `— ${c.businessName}`,
  ].join('\n');
}
