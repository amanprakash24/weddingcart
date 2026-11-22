import type { CustomerReceipt } from '@/lib/payments/customerPayment';
import { rupeesInWords } from '@/lib/payments/amountInWords';

// The printed payment receipt on the proposal link (Payments → Download / print). Only rendered while a receipt is being
// printed; everything else on the page is print:hidden then. A4, its own margins (the @page margin is 0, so the browser has
// no room for its date/URL header and footer), letterhead of whoever the couple paid — Shaadi Shopping on its own quotations,
// the business itself on its own (never Shaadi Shopping's branding on a venue's receipt).

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
const serif = { fontFamily: 'var(--font-playfair), serif' };

export interface ReceiptIssuer {
  name: string;
  phone: string | null;
  isPlatform: boolean;
  logoUrl: string | null;
  gstin: string | null;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#9A7B4F]">{children}</p>;
}

// The A4 page every printed customer document uses (receipt, invoice, quotation): only it prints while it is rendered.
export function PrintPage({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="receipt-print hidden text-[#2A1F1B] print:block">
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: #fff !important; }
          .receipt-print { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div className="mx-auto flex min-h-[285mm] w-[210mm] flex-col px-[16mm] pb-[12mm] pt-[14mm]">{children}</div>
    </section>
  );
}

// Gold rule + the issuer's letterhead + the document's title, number and date.
export function Letterhead({ issuer, title, facts }: { issuer: ReceiptIssuer; title: string; facts: [string, string][] }) {
  return (
    <>
      <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-[#8B1A4A] via-[#C5A46D] to-[#8B1A4A]" />
      <header className="mt-6 flex items-start justify-between gap-8">
        <div className="min-w-0">
          {issuer.isPlatform ? (
            // eslint-disable-next-line @next/next/no-img-element -- static logo in /public, printed as-is
            <img src="/logo-horizontal.png" alt="Shaadi Shopping" className="h-16 w-auto" />
          ) : (
            <div className="flex items-center gap-3">
              {issuer.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- the business's own logo, an address stored by our own upload route
                <img src={issuer.logoUrl} alt="" className="h-14 w-14 rounded-lg object-contain" />
              )}
              <p className="text-2xl leading-tight text-[#2A1F1B]" style={serif}>
                {issuer.name}
              </p>
            </div>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-[#6B5B4D]">
            {issuer.phone && <>Phone {issuer.phone}</>}
            {issuer.phone && issuer.gstin && <> · </>}
            {issuer.gstin && <>GSTIN {issuer.gstin}</>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[22px] tracking-[0.12em] text-[#8B1A4A]" style={serif}>
            {title}
          </p>
          <dl className="mt-3 grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-1 text-[11px]">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-[#9A8676]">{k}</dt>
                <dd className="font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>
      <div className="mt-6 h-px w-full bg-[#E8DCC8]" />
    </>
  );
}

export default function PaymentReceipt({
  receipt,
  issuer,
  coupleName,
  quotationNumber,
  weddingDate,
  total,
  history,
}: {
  receipt: CustomerReceipt;
  issuer: ReceiptIssuer;
  coupleName: string | null;
  quotationNumber: string;
  weddingDate: string | null;
  total: number;
  // Every receipt up to and including this one, oldest first — so an older receipt still shows the balance as it stood then.
  history: CustomerReceipt[];
}) {
  const paidTillDate = history.reduce((sum, r) => sum + r.amount, 0);
  const balance = Math.max(0, total - paidTillDate);
  return (
    <PrintPage label="Payment receipt">
        <Letterhead issuer={issuer} title="PAYMENT RECEIPT" facts={[['Receipt no.', receipt.number], ['Date', formatDate(receipt.paidAt)]]} />

        {/* Who paid, for what */}
        <div className="mt-6 grid grid-cols-2 gap-8">
          <div>
            <Label>Received from</Label>
            <p className="mt-1.5 text-lg" style={serif}>
              {coupleName ?? '—'}
            </p>
          </div>
          <div>
            <Label>Towards</Label>
            <p className="mt-1.5 text-sm font-semibold">Quotation {quotationNumber}</p>
            {weddingDate && <p className="text-sm text-[#6B5B4D]">Wedding on {formatDate(weddingDate)}</p>}
          </div>
        </div>

        {/* The amount */}
        <div className="relative mt-8 overflow-hidden rounded-2xl border border-[#E3D2B4] bg-[#FFF9F0] px-7 py-6">
          <Label>Amount received</Label>
          <p className="mt-2 text-[44px] leading-none tabular-nums text-[#2A1F1B]" style={serif}>
            {rupees(receipt.amount)}
          </p>
          <p className="mt-3 text-[12px] italic text-[#6B5B4D]">{rupeesInWords(receipt.amount)}</p>
          <div
            aria-hidden
            className="absolute right-8 top-1/2 -translate-y-1/2 -rotate-12 rounded-lg border-[3px] border-[#1F7A4D]/80 px-5 py-1.5 text-2xl font-bold tracking-[0.3em] text-[#1F7A4D]/80"
          >
            PAID
          </div>
        </div>

        {/* Payment details + where the account stands */}
        <div className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <Label>Payment details</Label>
            <dl className="mt-3 space-y-2 text-[12px]">
              <div className="flex justify-between gap-4 border-b border-[#F0E6D6] pb-2">
                <dt className="text-[#6B5B4D]">Payment mode</dt>
                <dd className="font-semibold">{receipt.method}</dd>
              </div>
              {receipt.reference && (
                <div className="flex justify-between gap-4 border-b border-[#F0E6D6] pb-2">
                  <dt className="text-[#6B5B4D]">Reference / UTR</dt>
                  <dd className="break-all text-right font-mono font-semibold">{receipt.reference}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-b border-[#F0E6D6] pb-2">
                <dt className="text-[#6B5B4D]">Date of payment</dt>
                <dd className="font-semibold">{formatDate(receipt.paidAt)}</dd>
              </div>
            </dl>
          </div>
          <div>
            <Label>Account summary</Label>
            <dl className="mt-3 space-y-2 text-[12px] tabular-nums">
              <div className="flex justify-between gap-4 border-b border-[#F0E6D6] pb-2">
                <dt className="text-[#6B5B4D]">Agreed total</dt>
                <dd className="font-semibold">{rupees(total)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#F0E6D6] pb-2">
                <dt className="text-[#6B5B4D]">Received till date</dt>
                <dd className="font-semibold text-[#1F7A4D]">{rupees(paidTillDate)}</dd>
              </div>
              <div className="flex justify-between gap-4 rounded-lg bg-[#2A1F1B] px-3 py-2 text-white">
                <dt>{balance > 0 ? 'Balance due' : 'Balance'}</dt>
                <dd className="font-semibold">{balance > 0 ? rupees(balance) : 'Fully paid'}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Every instalment so far — only worth a table once there is more than one */}
        {history.length > 1 && (
          <div className="mt-10">
            <Label>Payments so far</Label>
            <table className="mt-3 w-full text-[11.5px] tabular-nums">
              <thead>
                <tr className="border-b border-[#E3D2B4] text-left text-[#9A8676]">
                  <th className="py-2 pl-1 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Receipt no.</th>
                  <th className="py-2 pr-3 font-medium">Mode</th>
                  <th className="py-2 pr-1 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r, i) => (
                  <tr key={r.number} className={`border-b border-[#F0E6D6] ${r.number === receipt.number ? 'bg-[#FFF9F0] font-semibold' : ''}`}>
                    <td className="py-2 pl-1 pr-3">{i + 1}</td>
                    <td className="py-2 pr-3">{formatDate(r.paidAt)}</td>
                    <td className="py-2 pr-3">{r.number}</td>
                    <td className="py-2 pr-3">{r.method}</td>
                    <td className="py-2 pr-1 text-right">{rupees(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="py-2 pl-1 font-semibold">
                    Total received
                  </td>
                  <td className="py-2 pr-1 text-right font-semibold text-[#1F7A4D]">{rupees(paidTillDate)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Sign-off */}
        <div className="mt-auto pt-12">
          <div className="flex items-end justify-between gap-8">
            <div className="max-w-[60%]">
              <p className="text-xl text-[#8B1A4A]" style={serif}>
                Thank you
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#6B5B4D]">
                for choosing {issuer.name}. We look forward to being part of your celebrations.
              </p>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-semibold">For {issuer.name}</p>
              <p className="mt-1 text-[10px] text-[#9A8676]">Authorised signatory</p>
            </div>
          </div>
          <div className="mt-8 h-px w-full bg-[#E8DCC8]" />
          <p className="mt-3 text-center text-[9.5px] text-[#9A8676]">
            This is a computer-generated receipt and does not require a signature.
            {issuer.phone && <> For any questions, call {issuer.phone}.</>}
          </p>
        </div>
    </PrintPage>
  );
}
