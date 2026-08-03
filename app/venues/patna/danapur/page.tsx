import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { MapPin, ChevronRight, Phone } from 'lucide-react';
import { SHAADI_PHONE, SHAADI_PHONE_DISPLAY, shaadiWhatsAppLink } from '@/lib/shaadiContact';
import { VenueFilterList, type LocalityVenue } from '@/components/venues/VenueFilterList';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';
const PAGE_URL = `${BASE_URL}/venues/patna/danapur`;
const SHAADI_WA = shaadiWhatsAppLink('Hi, I am looking for a wedding venue in Danapur, Patna. Please help.');

export const metadata: Metadata = {
  title: 'Banquet Halls in Danapur, Patna — Verified Venues & Pricing | ShaadiShopping',
  description:
    'Looking for a banquet hall in Danapur, Patna? Compare verified venues like Swayamvar Hall & Homestay — real pricing from ₹1,000/plate, capacity up to 500 guests. Free consultation with a ShaadiShopping Wedding Expert.',
  keywords: [
    'banquet hall danapur',
    'wedding venue danapur patna',
    'marriage hall danapur',
    'danapur wedding hall',
    'wedding venues gola road patna',
    'banquet halls in patna danapur',
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'Banquet Halls in Danapur, Patna — Verified Venues & Pricing',
    description: 'Compare verified Danapur wedding venues — real pricing, capacity, and photos. Get a free quote via ShaadiShopping.',
    url: PAGE_URL,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
  },
  robots: { index: true, follow: true },
};

const VENUES: LocalityVenue[] = [
  {
    name: 'Swayamvar Hall & Homestay',
    tagline: 'Large-Capacity Hall with Home Stay',
    area: 'Gola Road, near Chanakya Puri, Danapur',
    rating: 4.8,
    capacityLabel: 'Up to 500 guests',
    capacityMax: 500,
    vegPrice: 1000,
    nonVegPrice: 1300,
    rooms: 'Home stay available',
    highlights: ['AC banquet hall', 'In-house catering & décor', 'Stage & sound setup', 'Power backup', '10+ years experience'],
    href: '/vendors/swayamvar-hall-patna',
    image: 'https://res.cloudinary.com/djaif7u83/image/upload/v1782029500/shaadishopping/swayamvar-hall/best-banquet-hall-swayamvar.jpg',
    imageAlt: 'Swayamvar Hall banquet hall, Danapur Patna',
  },
];

const FAQS = [
  {
    q: 'What is the average wedding budget for a venue in Danapur?',
    a: 'Danapur banquet halls typically charge ₹1,000–₹1,300 per plate all-inclusive (hall, catering, and basic décor) — in line with Patna\'s overall ₹999–₹1,600/plate range. For a 300–400 guest wedding, that works out to roughly ₹5–10 lakh for the venue and catering alone; total wedding budgets in Patna commonly run ₹5 lakh to ₹50 lakh depending on guest count and services.',
  },
  {
    q: 'How many guests can Danapur banquet halls accommodate?',
    a: 'Danapur is known for large-capacity halls built to handle big Bihari weddings — Swayamvar Hall & Homestay on Gola Road accommodates up to 500 guests. As with any venue, always ask for the seated dinner capacity separately, since it\'s usually lower than the stated maximum.',
  },
  {
    q: 'Is parking available at Danapur wedding venues?',
    a: 'Gola Road and the surrounding Danapur cantonment roads are wider than much of central Patna, which generally makes vehicle access and baraat processions easier. Even so, confirm the exact number of parking spots with the venue directly rather than relying on "ample parking" claims.',
  },
  {
    q: 'How far is Danapur from central Patna and Danapur Railway Junction?',
    a: 'Danapur sits on the western edge of Patna and is home to Danapur Railway Junction, one of the region\'s major stations — a genuine advantage if you have outstation guests arriving by train. It\'s a straightforward drive from central Patna via Gola Road.',
  },
  {
    q: 'Do Danapur venues provide accommodation for outstation guests?',
    a: 'Yes — Swayamvar Hall & Homestay offers an on-site home stay option, which is useful if a meaningful share of your guest list is travelling from outside Patna.',
  },
];

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Venues', item: `${BASE_URL}/venues/patna` },
    { '@type': 'ListItem', position: 3, name: 'Patna', item: `${BASE_URL}/venues/patna` },
    { '@type': 'ListItem', position: 4, name: 'Danapur', item: PAGE_URL },
  ],
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Swayamvar Hall & Homestay',
  image: VENUES[0].image,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Gola Road, near Chanakya Puri',
    addressLocality: 'Danapur, Patna',
    addressRegion: 'Bihar',
    addressCountry: 'IN',
  },
  priceRange: '₹1,000–₹1,300 per plate',
  aggregateRating: { '@type': 'AggregateRating', ratingValue: VENUES[0].rating, reviewCount: 500 },
  url: `${BASE_URL}/vendors/swayamvar-hall-patna`,
};

export default function DanapurVenuesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={localBusinessSchema} />

      <div className="min-h-screen bg-[#FFFAF5]">
        {/* ── HERO ── */}
        <section className="bg-[#1C1208] py-14 sm:py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <nav className="flex items-center justify-center flex-wrap gap-2 text-[#C5A46D]/60 text-xs mb-6">
              <Link href="/" className="hover:text-[#C5A46D] transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <Link href="/venues/patna" className="hover:text-[#C5A46D] transition-colors">Venues in Patna</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-[#C5A46D]">Danapur</span>
            </nav>

            <div className="inline-flex items-center gap-2 bg-[#C5A46D]/15 border border-[#C5A46D]/30 text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full mb-5">
              <MapPin className="w-3 h-3" /> Danapur, Patna
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-5" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Banquet Halls in Danapur, Patna
            </h1>
            <p className="text-white/65 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-8">
              Patna&apos;s most active wedding corridor — large-capacity halls built for big baraats, verified by our Patna team.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href={SHAADI_WA} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold px-7 py-4 rounded-full text-sm shadow-lg hover:opacity-90 transition-all">
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
          <div className="prose-content text-gray-600 text-sm sm:text-base leading-relaxed space-y-5">
            <p>
              Danapur is one of Patna&apos;s oldest and most established localities — a former cantonment town on the city&apos;s
              western edge, built around wide roads that were originally laid out for military use. That same width is
              exactly why it has become Patna&apos;s most active wedding corridor today: unlike the narrower lanes of central
              Patna, Gola Road and the surrounding streets can comfortably handle baraat processions, decorated vehicles,
              and the guest traffic that comes with a large Bihari wedding.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Average venue budgets.</strong> Banquet halls in Danapur typically charge
              ₹1,000–₹1,300 per plate all-inclusive — hall rental, in-house catering, and basic décor bundled together.
              That places Danapur squarely within Patna&apos;s overall ₹999–₹1,600 per-plate range. For a wedding with
              300–400 guests, venue and catering together usually work out to roughly ₹5–10 lakh; across all functions
              (sangeet, haldi, baraat, reception), most Patna families plan for a total wedding budget somewhere between
              ₹5 lakh and ₹50 lakh depending on guest count and the level of décor and entertainment involved.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Best guest capacities.</strong> Danapur halls are generally built for
              scale — 400 to 500+ guests is common, which is well suited to multi-day Bihari weddings where the baraat,
              reception, and family functions can each draw a large crowd. One important distinction worth knowing before
              you book: a hall&apos;s advertised "capacity" is often a standing or event-floor figure, not the number of
              guests it can comfortably seat for a sit-down dinner. Always ask a venue for its seated dinner capacity
              specifically — it&apos;s usually meaningfully lower than the headline number.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Parking and accessibility.</strong> Because Danapur&apos;s roads were
              built wider than much of central Patna, vehicle access and parking tend to be less chaotic here than at
              venues tucked into older, narrower neighbourhoods. That said, "ample parking" is a claim every venue makes —
              what matters is the actual number of vehicles a hall can accommodate on its own premises versus on the
              street outside. Danapur is also home to Danapur Railway Junction, one of the region&apos;s major stations,
              which is a genuine convenience if a large share of your guest list is travelling in from outside Patna.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Nearby wedding shopping.</strong> Danapur itself is primarily a
              residential and venue corridor rather than a shopping destination. For lehengas, jewellery, and wedding
              invitations, most Danapur families travel roughly 20–30 minutes into central Patna, where Boring Road and
              Bailey Road are the city&apos;s two best-known wedding-shopping corridors.
            </p>
          </div>
        </section>

        {/* ── VENUES + FILTERS ── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 sm:pb-20">
          <div className="text-center mb-8">
            <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-2">Verified & Trusted</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#2A1F1B]" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Verified Wedding Venues in Danapur
            </h2>
          </div>
          <VenueFilterList venues={VENUES} />
        </section>

        {/* ── NEARBY AREAS ── */}
        <section className="bg-white border-y border-[#C5A46D]/15 py-12 sm:py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl sm:text-2xl font-bold text-[#2A1F1B] mb-6 text-center" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Nearby Patna Wedding Areas
            </h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { name: 'Saguna Mor', href: '/venues/patna/saguna-mor', desc: 'Just down Danapur Khagaul Road — newer venues, in-house DJ options.' },
                { name: 'All Patna Venues', href: '/venues/patna', desc: 'Compare every verified venue we list across Patna.' },
                { name: 'Boring Road', href: '/venues/patna/boring-road', desc: 'Patna\'s premier shopping corridor, ~20–30 min from Danapur.' },
              ].map(({ name, href, desc }) => (
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
              Danapur Wedding Venues — FAQ
            </h2>
          </div>
          <div className="space-y-4">
            {FAQS.map(({ q, a }) => (
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
              Book a Venue in Danapur — Free Consultation
            </h2>
            <p className="text-white/65 text-sm mb-8 max-w-xl mx-auto">
              Our Patna team visits every venue, negotiates pricing on your behalf, and responds within 30 minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href={SHAADI_WA} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold px-8 py-4 rounded-full text-sm shadow-lg hover:opacity-90 transition-all">
                WhatsApp for Free Quote
              </a>
              <a href={`tel:${SHAADI_PHONE}`} className="inline-flex items-center justify-center gap-2 border-2 border-white/30 text-white font-semibold px-8 py-4 rounded-full text-sm hover:bg-white/10 transition-all">
                <Phone className="w-4 h-4" /> {SHAADI_PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
