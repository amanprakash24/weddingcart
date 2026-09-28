import Link from 'next/link';
import type { VendorProposal, VendorProposalSummary } from '@/lib/quotation/vendorProposal';

// Vendor Proposal View (docs/wedding-os/04-vendor-os.md "Proposal view"). Display only — no actions. Everything shown
// was already reduced on the server to this vendor's own work (services/vendorProposal.service.ts); this file adds no
// data of its own. Self-contained so it can move into the fuller Vendor OS layout later unchanged.

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const dateLabel = (value: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
};
const STATUS_LABEL = { ACCEPTED: 'Accepted by the couple', BOOKED: 'Booked' } as const;
const STATUS_CLASS = { ACCEPTED: 'bg-amber-100 text-amber-900', BOOKED: 'bg-emerald-100 text-emerald-900' } as const;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">{children}</div>
    </main>
  );
}

function weddingLine(w: VendorProposal['wedding']) {
  return [dateLabel(w.date), w.guestCount != null ? `${w.guestCount} guests` : null, w.city, w.eventType].filter(Boolean).join(' · ');
}

export function VendorProposalList({ proposals }: { proposals: VendorProposalSummary[] }) {
  return (
    <Shell>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Vivah OS · Vendor Portal</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Accepted proposals</h1>
          <p className="mt-1 text-sm text-slate-600">Your work on proposals the couple has accepted.</p>
        </div>
        <Link href="/vendor" className="text-sm font-medium text-slate-600 underline underline-offset-4">Back to portal</Link>
      </header>
      {proposals.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">No accepted proposals include your services yet.</p>
      ) : (
        <ul className="space-y-3">
          {proposals.map((p) => (
            <li key={p.id}>
              <Link href={`/vendor/proposals/${p.id}`} className="block rounded-2xl bg-white p-5 shadow-sm hover:ring-2 hover:ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{p.wedding.name ?? p.number}</p>
                    <p className="mt-1 text-sm text-slate-600">{weddingLine(p.wedding)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                </div>
                <p className="mt-3 text-sm text-slate-700">
                  {p.lineCount} {p.lineCount === 1 ? 'item' : 'items'} · <span className="font-semibold">{rupees(p.total)}</span>
                  <span className="text-slate-400"> · {p.number} v{p.version}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

export function VendorProposalDetail({ proposal: p }: { proposal: VendorProposal }) {
  return (
    <Shell>
      <Link href="/vendor/proposals" className="text-sm font-medium text-slate-600 underline underline-offset-4">All accepted proposals</Link>
      <header className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Proposal {p.number} · version {p.version}</p>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
        </div>
        <h1 className="mt-3 text-2xl font-bold">{p.wedding.name ?? 'Wedding'}</h1>
        <p className="mt-1 text-sm text-white/80">{weddingLine(p.wedding)}</p>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm" aria-label="Your work">
        <h2 className="mb-3 text-lg font-bold text-slate-900">Your work</h2>
        <div role="table" className="text-sm">
          <div role="row" className="hidden grid-cols-[1fr_140px_120px] border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:grid">
            <span role="columnheader">Service</span>
            <span role="columnheader" className="text-right">Qty × price</span>
            <span role="columnheader" className="text-right">Amount</span>
          </div>
          {p.lines.map((l, i) => (
            <div key={i} role="row" className="grid grid-cols-[1fr_auto] gap-x-3 border-b border-slate-100 py-3 sm:grid-cols-[1fr_140px_120px]">
              <span role="cell">
                <span className="font-medium text-slate-900">{l.description}</span>
                <span className="block text-xs text-slate-500">{[l.category, l.functionLabel].filter(Boolean).join(' · ')}</span>
                <span className="block text-xs text-slate-500 sm:hidden">{l.quantity} × {rupees(l.unitPrice)}</span>
              </span>
              <span role="cell" className="hidden text-right text-slate-600 sm:block">{l.quantity} × {rupees(l.unitPrice)}</span>
              <span role="cell" className="text-right tabular-nums text-slate-900">{rupees(l.lineTotal)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between text-base font-bold text-slate-900">
          <span>Agreed amount for your work</span>
          <span className="tabular-nums">{rupees(p.total)}</span>
        </div>
      </section>

      {p.venue.length > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-sm" aria-label="Venue">
          <h2 className="mb-3 text-lg font-bold text-slate-900">Where and when</h2>
          <ul className="space-y-2 text-sm">
            {p.venue.map((v, i) => (
              <li key={i} className="rounded-xl bg-slate-50 p-3">
                <p className="font-medium text-slate-900">{v.function} · {dateLabel(v.date)}{v.startTime ? ` · ${v.startTime}` : ''}</p>
                <p className="text-slate-600">{[v.venueName, v.venueAddress, v.city].filter(Boolean).join(', ')}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-slate-500">Client contact details and other services on this wedding are not shown. For any question, contact the Shaadi Shopping team.</p>
    </Shell>
  );
}
