import { Letterhead } from '@/components/proposal/PaymentReceipt';
import { SHAADI_PHONE_DISPLAY } from '@/lib/shaadiContact';
import type { VendorWorkOrderView } from '@/lib/vendor/workOrder';

// A vendor work order as a printable document (money design v1, PR 4, 25 Nov 2026) — Shaadi Shopping's letterhead, the scope, the
// vendor's own amount and the terms. The vendor's page passes no `internal`; the team's page passes it (client price for the team;
// commission and margin only for the founder). Nothing internal is ever rendered for a vendor.

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const day = (ymd: string) => (ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
const issued = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

export interface WorkOrderInternal {
  pricingModel: 'COMMISSION' | 'FIXED';
  clientPrice: number;
  commissionRate: number | null; // founder only
  commissionAmount: number | null; // founder only
  margin: number | null; // founder only
  historical: boolean;
}

export default function WorkOrderDocument({ wo, vendorName, showAmount, internal = null }: { wo: VendorWorkOrderView; vendorName: string; showAmount: boolean; internal?: WorkOrderInternal | null }) {
  const s = wo.scope;
  const rows: [string, string | null][] = [
    ['Wedding', [s.weddingNumber, s.coupleName].filter(Boolean).join(' · ')],
    ['Function', s.functionName],
    ['Date', [day(s.functionDate), s.startTime].filter(Boolean).join(' · ')],
    ['Place', [s.venueName, s.venueAddress, s.city].filter(Boolean).join(', ') || null],
    ['Guests', s.guestCount != null ? s.guestCount.toLocaleString('en-IN') : null],
  ];
  return (
    <article className="mx-auto max-w-3xl bg-white p-6 text-[#2A1F1B] sm:p-10 print:p-0">
      <Letterhead
        issuer={{ name: 'Shaadi Shopping', phone: SHAADI_PHONE_DISPLAY, isPlatform: true, logoUrl: null, gstin: null }}
        title="WORK ORDER"
        facts={[['Work order no.', wo.number], ['Issued', issued(wo.issuedAt)], ...(wo.status === 'CANCELLED' ? [['Status', 'Cancelled'] as [string, string]] : [])]}
      />

      {wo.status === 'CANCELLED' && (
        <p role="status" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          Cancelled{wo.cancelledAt ? ` on ${issued(wo.cancelledAt)}` : ''}{wo.cancelReason ? ` — ${wo.cancelReason}` : ''}. This work order is kept for the record and is no longer in force.
        </p>
      )}

      <section className="mt-6 grid gap-4 border-t border-[#E8DCC8] pt-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8B1A4A]">Issued to</p>
          <p className="mt-1 text-base font-semibold">{vendorName}</p>
          <p className="text-[#6B5B4D]">{s.service}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-[#6B5B4D]">{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      </section>

      <section className="mt-6 border-t border-[#E8DCC8] pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8B1A4A]">The work</p>
        <p className="mt-1 font-semibold">{s.packageName ?? s.service}</p>
        {s.deliverables ? <p className="mt-1 whitespace-pre-line text-sm text-[#4A3B30]">{s.deliverables}</p> : <p className="mt-1 text-sm text-[#6B5B4D]">{s.service} for {s.functionName}, as agreed with the Shaadi Shopping coordinator.</p>}
      </section>

      {showAmount && (
        <section className="mt-6 flex items-baseline justify-between border-y border-[#E8DCC8] py-4">
          <span className="text-sm text-[#6B5B4D]">Your amount for this work</span>
          <span className="text-2xl font-semibold tabular-nums">{inr(wo.vendorPayable)}</span>
        </section>
      )}

      <section className="mt-6 text-xs leading-relaxed text-[#6B5B4D]">
        <p className="font-semibold uppercase tracking-[0.2em] text-[#8B1A4A]">Terms</p>
        <p className="mt-1">{s.terms}</p>
      </section>

      {internal && (
        <aside aria-label="Internal" className="mt-8 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-700 print:hidden">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Internal — never shown to the vendor</p>
          <p className="mt-1">
            {internal.pricingModel === 'FIXED' ? 'Fixed vendor price' : 'Commission model'} · couple’s price {inr(internal.clientPrice)}
            {internal.commissionAmount !== null && ` · commission ${inr(internal.commissionAmount)} (${internal.commissionRate}%)`}
            {internal.margin !== null && ` · margin ${inr(internal.margin)}`}
            {internal.historical && ' · issued later for an earlier confirmation'}
          </p>
        </aside>
      )}
    </article>
  );
}
