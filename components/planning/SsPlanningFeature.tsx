import Link from 'next/link';
import { SS_PLANNING } from '@/lib/planning/ssPlanning';
import { shaadiWhatsAppLink } from '@/lib/shaadiContact';

// Wedding Planning & Coordination is what Shaadi Shopping itself does (26 Nov 2026). On the website's planning category pages
// our own card comes first, always, with our own number — not a vendor listing, and never a price.
export default function SsPlanningFeature({ city }: { city?: string }) {
  return (
    <section aria-label={`${SS_PLANNING.provider} — ${SS_PLANNING.service}`} className="mb-8 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-rose-50 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">{SS_PLANNING.service}</p>
      <h2 className="mt-1.5 text-2xl font-bold text-gray-900 font-playfair">{SS_PLANNING.provider}</h2>
      <p className="mt-2 max-w-2xl text-gray-600">
        {SS_PLANNING.covers} Included with every wedding we plan{city ? ` in ${city}` : ''}.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/plan" className="inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-amber-500 to-rose-500 px-6 text-sm font-semibold text-white">
          Plan my wedding
        </Link>
        <a
          href={shaadiWhatsAppLink('Namaste, we would like Shaadi Shopping to plan and coordinate our wedding.')}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-full border border-gray-300 bg-white px-6 text-sm font-semibold text-gray-800"
        >
          WhatsApp us
        </a>
      </div>
    </section>
  );
}
