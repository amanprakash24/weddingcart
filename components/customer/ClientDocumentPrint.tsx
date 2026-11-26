import { Label, Letterhead, PrintPage, type ReceiptIssuer } from '@/components/proposal/PaymentReceipt';
import { rupeesInWords } from '@/lib/payments/amountInWords';
import type { ClientDocumentLine } from '@/services/clientPortal.service';
import { SS_PLANNING } from '@/lib/planning/ssPlanning';

// The couple's printable invoice or accepted quotation on My Wedding (22 Nov 2026). Same A4 letterhead as the payment receipt.
// Only rendered while it is being printed (everything else on the page is print:hidden then).

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso));

export interface PrintableDocument {
  title: 'TAX INVOICE' | 'INVOICE' | 'QUOTATION' | 'CREDIT NOTE';
  number: string;
  date: string | null;
  subject: string; // "Booking amount", "Balance", "Accepted quotation, version 2" …
  lines: ClientDocumentLine[];
  subtotal: number;
  discount: number;
  gstAmount: number;
  total: number;
  gstin: string | null; // printed whenever there is a GST line
  paid: number | null; // invoices only
  terms: string | null; // quotations only
  credited?: number; // invoices: credit notes against it (PR 7) — they lower the balance, they are not money received
  against?: string | null; // credit notes: the invoice number it credits
}

export default function ClientDocumentPrint({ doc, issuer, coupleName, weddingNumber, weddingDate }: { doc: PrintableDocument; issuer: ReceiptIssuer; coupleName: string; weddingNumber: string; weddingDate: string }) {
  const showUnit = doc.lines.some((l) => l.unitPrice !== null);
  const isCredit = doc.title === 'CREDIT NOTE';
  const facts: [string, string][] = [[doc.title === 'QUOTATION' ? 'Quotation no.' : isCredit ? 'Credit note no.' : 'Invoice no.', doc.number]];
  if (doc.date) facts.push(['Date', formatDate(doc.date)]);
  if (isCredit && doc.against) facts.push(['Against invoice', doc.against]);
  const credited = doc.credited ?? 0;
  const balance = doc.paid !== null ? Math.max(0, doc.total - doc.paid - credited) : null;
  return (
    <PrintPage label={doc.title === 'QUOTATION' ? 'Quotation' : isCredit ? 'Credit note' : 'Invoice'}>
      <Letterhead issuer={{ ...issuer, gstin: doc.gstAmount > 0 ? (doc.gstin ?? issuer.gstin) : issuer.gstin }} title={doc.title} facts={facts} />

      <div className="mt-6 grid grid-cols-2 gap-8">
        <div>
          <Label>{doc.title === 'QUOTATION' ? 'Prepared for' : isCredit ? 'Credited to' : 'Billed to'}</Label>
          <p className="mt-1.5 text-lg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            {coupleName}
          </p>
        </div>
        <div>
          <Label>For</Label>
          <p className="mt-1.5 text-sm font-semibold">{doc.subject}</p>
          <p className="text-sm text-[#6B5B4D]">
            Wedding {weddingNumber} · {formatDate(weddingDate)}
          </p>
        </div>
      </div>

      <table className="mt-8 w-full text-[11.5px] tabular-nums">
        <thead>
          <tr className="border-b border-[#E3D2B4] text-left text-[#9A8676]">
            <th className="py-2 pl-1 pr-3 font-medium">#</th>
            <th className="py-2 pr-3 font-medium">Description</th>
            <th className="py-2 pr-3 text-right font-medium">Qty</th>
            {showUnit && <th className="py-2 pr-3 text-right font-medium">Rate</th>}
            <th className="py-2 pr-1 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((l, i) => (
            <tr key={i} className="border-b border-[#F0E6D6] align-top">
              <td className="py-2 pl-1 pr-3">{i + 1}</td>
              <td className="py-2 pr-3">{l.description}</td>
              <td className="py-2 pr-3 text-right">{l.quantity}</td>
              {showUnit && <td className="py-2 pr-3 text-right">{l.unitPrice !== null ? rupees(l.unitPrice) : ''}</td>}
              <td className="py-2 pr-1 text-right">{rupees(l.amount)}</td>
            </tr>
          ))}
          {/* Shaadi Shopping's own planning & coordination — always included, never a price, never in the totals (lib/planning/ssPlanning.ts). */}
          {issuer.isPlatform && (
            <tr className="border-b border-[#F0E6D6] align-top">
              <td className="py-2 pl-1 pr-3">{doc.lines.length + 1}</td>
              <td className="py-2 pr-3">
                {SS_PLANNING.service} — {SS_PLANNING.provider}
              </td>
              <td className="py-2 pr-3 text-right">—</td>
              {showUnit && <td className="py-2 pr-3 text-right"></td>}
              <td className="py-2 pr-1 text-right italic">{SS_PLANNING.included}</td>
            </tr>
          )}
        </tbody>
      </table>

      <dl className="ml-auto mt-4 w-[78mm] space-y-1.5 text-[12px] tabular-nums">
        <div className="flex justify-between">
          <dt className="text-[#6B5B4D]">Subtotal</dt>
          <dd>{rupees(doc.subtotal)}</dd>
        </div>
        {doc.discount > 0 && (
          <div className="flex justify-between">
            <dt className="text-[#6B5B4D]">Discount</dt>
            <dd>− {rupees(doc.discount)}</dd>
          </div>
        )}
        {doc.gstAmount > 0 && (
          <div className="flex justify-between">
            <dt className="text-[#6B5B4D]">GST</dt>
            <dd>{rupees(doc.gstAmount)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-[#E3D2B4] pt-2 text-[13px] font-semibold">
          <dt>{isCredit ? 'Credit total' : 'Total'}</dt>
          <dd>{rupees(doc.total)}</dd>
        </div>
        {doc.paid !== null && balance !== null && (
          <>
            <div className="flex justify-between">
              <dt className="text-[#6B5B4D]">Received</dt>
              <dd className="text-[#1F7A4D]">{rupees(doc.paid)}</dd>
            </div>
            {credited > 0 && (
              <div className="flex justify-between">
                <dt className="text-[#6B5B4D]">Credit notes</dt>
                <dd>− {rupees(credited)}</dd>
              </div>
            )}
            <div className="flex justify-between rounded-lg bg-[#2A1F1B] px-3 py-1.5 text-white">
              <dt>{balance > 0 ? 'Balance due' : 'Status'}</dt>
              <dd className="font-semibold">{balance > 0 ? rupees(balance) : credited > 0 ? 'Settled' : 'Paid in full'}</dd>
            </div>
          </>
        )}
      </dl>
      <p className="mt-3 text-right text-[11px] italic text-[#6B5B4D]">{rupeesInWords(doc.total)}</p>

      {doc.terms && (
        <div className="mt-8">
          <Label>Terms</Label>
          <p className="mt-2 whitespace-pre-line text-[11px] leading-relaxed text-[#4A3F38]">{doc.terms}</p>
        </div>
      )}

      <div className="mt-auto pt-10">
        <div className="flex items-end justify-between gap-8">
          <p className="max-w-[60%] text-[11px] leading-relaxed text-[#6B5B4D]">Thank you for choosing {issuer.name}.</p>
          <div className="text-right">
            <p className="text-[12px] font-semibold">For {issuer.name}</p>
            <p className="mt-1 text-[10px] text-[#9A8676]">Authorised signatory</p>
          </div>
        </div>
        <div className="mt-6 h-px w-full bg-[#E8DCC8]" />
        <p className="mt-3 text-center text-[9.5px] text-[#9A8676]">
          This is a computer-generated document and does not require a signature.
          {issuer.phone && <> For any questions, call {issuer.phone}.</>}
        </p>
      </div>
    </PrintPage>
  );
}
