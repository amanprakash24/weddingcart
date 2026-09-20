import { Phone, MessageCircle } from 'lucide-react';
import { SOURCE_LABELS, type SourceType } from '@/components/crm/types';
import { whatsappUrl } from '@/lib/crm/journeyMessage';
import type { LeadWorkspace } from './types';

// Client and wedding facts in one card (it replaces the separate Customer and Wedding Details cards).
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="m-0 font-medium text-gray-900">{children}</dd>
    </div>
  );
}

export default function ClientCard({ customer, details, sourceType }: { customer: LeadWorkspace['customer']; details: LeadWorkspace['weddingDetails']; sourceType: SourceType }) {
  const digits = customer.phone.replace(/\D/g, '');
  const chat = whatsappUrl(customer.phone, '');
  const money = (n: number | null) => (n != null ? `₹${n.toLocaleString('en-IN')}` : null);
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5" aria-label="Client and wedding">
      <h2 className="mb-2 font-sans text-[11px] font-bold uppercase tracking-widest text-gray-400">Client &amp; wedding</h2>
      <dl className="m-0">
        <Row label="Customer">{customer.name ?? '—'}</Row>
        <Row label="Phone">{customer.phone}</Row>
        {customer.email && <Row label="Email">{customer.email}</Row>}
        <Row label="Came from">{SOURCE_LABELS[sourceType]}</Row>
        <Row label="City">{customer.city ?? '—'}</Row>
        <Row label="Wedding date">{details.date ?? '—'}</Row>
        {details.type && <Row label="Type">{details.type}</Row>}
        <Row label="Guests">{details.guestCount != null ? details.guestCount : '—'}</Row>
        {details.venueType && <Row label="Venue type">{details.venueType}</Row>}
        <Row label="Their budget">{money(details.budget) ?? '—'}</Row>
        {details.services.length > 0 && (
          <Row label="Looking for">
            <span className="flex flex-wrap gap-1.5">
              {details.services.map((s) => (
                <span key={s} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{s}</span>
              ))}
            </span>
          </Row>
        )}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {digits && (
          <a href={`tel:${digits}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-200 px-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <Phone className="h-4 w-4" />
            Call
          </a>
        )}
        {chat && (
          <a href={chat} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-200 px-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        )}
      </div>
    </section>
  );
}
