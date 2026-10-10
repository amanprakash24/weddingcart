// The UPI payee and deep link — dependency-free, so the proposal page (client) can import it. Roadmap 1.3, 08-quotation.md §20.

export interface UpiPayee {
  vpa: string; // where the money goes: Shaadi Shopping's own UPI ID on its quotations, the business's own (Settings) on its own
  payee: string; // the name the couple's UPI app shows
}

const VPA = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,64}$/;

// From the server's env (SHAADI_UPI_ID / SHAADI_UPI_NAME). Missing or malformed = null, and the page shows no UPI payment at all —
// never a half-configured QR that could send money somewhere wrong.
export function upiPayeeFrom(env: { SHAADI_UPI_ID?: string; SHAADI_UPI_NAME?: string }): UpiPayee | null {
  const vpa = env.SHAADI_UPI_ID?.trim() ?? '';
  const payee = env.SHAADI_UPI_NAME?.trim() ?? '';
  if (!VPA.test(vpa) || !payee || payee.length > 60) return null;
  return { vpa, payee };
}

// A business's own payee, for its OWN quotations (Settings: Business.upiId / upiName). The name the couple checks in their UPI app
// is the one the business typed, else the business's name. Missing or malformed = null — no UPI payment is shown at all.
export function upiPayeeOf(b: { upiId: string | null; upiName: string | null; name: string }): UpiPayee | null {
  const vpa = b.upiId?.trim() ?? '';
  const payee = (b.upiName?.trim() || b.name.trim()).slice(0, 60);
  if (!VPA.test(vpa) || !payee) return null;
  return { vpa, payee };
}

// The standard UPI deep link (NPCI "upi://pay"). Any UPI app opens it with the payee, amount and note filled in; the QR encodes the
// same text. The amount is fixed so the couple cannot mistype it in their app.
export function upiLink(payee: UpiPayee, amount: number, note: string): string {
  const params = [
    `pa=${payee.vpa}`, // left as is: some apps reject an encoded "@"
    `pn=${encodeURIComponent(payee.payee)}`,
    `am=${amount}.00`,
    'cu=INR',
    `tn=${encodeURIComponent(note.slice(0, 50))}`,
  ];
  return `upi://pay?${params.join('&')}`;
}
