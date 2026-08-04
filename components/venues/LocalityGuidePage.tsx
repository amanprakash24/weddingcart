import type { ReactNode } from 'react';
import Link from 'next/link';
import { MapPin, ChevronRight, Phone, Info } from 'lucide-react';
import { SHAADI_PHONE, SHAADI_PHONE_DISPLAY, shaadiWhatsAppLink } from '@/lib/shaadiContact';

export interface LocalityGuideFaq {
  q: string;
  a: string;
}

export interface LocalityGuideArea {
  name: string;
  href: string;
  desc: string;
}

export function LocalityGuidePage({
  localityName,
  breadcrumbLabel,
  tagline,
  content,
  honestNote,
  nearbyAreas,
  faqs,
  whatsappMessage,
}: {
  localityName: string;
  breadcrumbLabel: string;
  tagline: string;
  content: ReactNode;
  honestNote: string;
  nearbyAreas: LocalityGuideArea[];
  faqs: LocalityGuideFaq[];
  whatsappMessage: string;
}) {
  const wa = shaadiWhatsAppLink(whatsappMessage);

  return (
    <div className="min-h-screen bg-[#FFFAF5]">
      {/* ── HERO ── */}
      <section className="bg-[#1C1208] py-14 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <nav className="flex items-center justify-center flex-wrap gap-2 text-[#C5A46D]/60 text-xs mb-6">
            <Link href="/" className="hover:text-[#C5A46D] transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/venues/patna" className="hover:text-[#C5A46D] transition-colors">Venues in Patna</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-[#C5A46D]">{breadcrumbLabel}</span>
          </nav>

          <div className="inline-flex items-center gap-2 bg-[#C5A46D]/15 border border-[#C5A46D]/30 text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full mb-5">
            <MapPin className="w-3 h-3" /> {breadcrumbLabel}, Patna
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-5" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
            Wedding Venues Near {localityName}, Patna
          </h1>
          <p className="text-white/65 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-8">{tagline}</p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold px-7 py-4 rounded-full text-sm shadow-lg hover:opacity-90 transition-all">
              WhatsApp Us — Free Quote
            </a>
            <a href={`tel:${SHAADI_PHONE}`} className="inline-flex items-center justify-center gap-2 border border-[#C5A46D]/40 text-[#C5A46D] font-semibold px-7 py-4 rounded-full text-sm hover:bg-[#C5A46D]/10 transition-all">
              <Phone className="w-4 h-4" /> Talk to a Wedding Expert
            </a>
          </div>
        </div>
      </section>

      {/* ── UNIQUE CONTENT ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="prose-content text-gray-600 text-sm sm:text-base leading-relaxed space-y-5">{content}</div>
      </section>

      {/* ── HONEST CALLOUT (no fabricated venues) ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 sm:pb-20">
        <div className="flex items-start gap-3 bg-[#FAF5EE] border border-[#C5A46D]/25 rounded-2xl px-6 py-5">
          <Info className="w-5 h-5 text-[#C5A46D] flex-shrink-0 mt-0.5" />
          <p className="text-[#6B5B4D] text-sm leading-relaxed">{honestNote}</p>
        </div>
      </section>

      {/* ── NEARBY AREAS / REAL VENUES ── */}
      <section className="bg-white border-y border-[#C5A46D]/15 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl font-bold text-[#2A1F1B] mb-6 text-center" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
            Verified Patna Venues Worth Considering
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {nearbyAreas.map(({ name, href, desc }) => (
              <Link key={name} href={href} className="group block rounded-xl border border-[#C5A46D]/15 hover:border-[#C5A46D]/40 px-4 py-4 transition-colors">
                <p className="font-semibold text-[#2A1F1B] text-sm group-hover:text-[#8B1A4A] transition-colors mb-1 flex items-center gap-1">
                  {name} <ChevronRight className="w-3.5 h-3.5" />
                </p>
                <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="text-center mb-10">
          <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-2">Common Questions</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#2A1F1B]" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
            {localityName} Wedding Venues — FAQ
          </h2>
        </div>
        <div className="space-y-4">
          {faqs.map(({ q, a }) => (
            <div key={q} className="bg-white rounded-2xl border border-[#C5A46D]/15 px-6 py-5">
              <h3 className="font-bold text-[#2A1F1B] text-sm mb-2">{q}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="bg-[#8B1A4A] py-14 sm:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
            Planning a Wedding Near {localityName}? Talk to Us — Free
          </h2>
          <p className="text-white/65 text-sm mb-8 max-w-xl mx-auto">
            Our Patna team knows every verified venue in the city and will recommend the best fit for your budget, guest count, and location — no hidden charges, no spam.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold px-8 py-4 rounded-full text-sm shadow-lg hover:opacity-90 transition-all">
              WhatsApp for Free Quote
            </a>
            <a href={`tel:${SHAADI_PHONE}`} className="inline-flex items-center justify-center gap-2 border-2 border-white/30 text-white font-semibold px-8 py-4 rounded-full text-sm hover:bg-white/10 transition-all">
              <Phone className="w-4 h-4" /> {SHAADI_PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
