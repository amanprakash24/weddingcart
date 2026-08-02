import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { MapPin, ChevronRight, Phone } from 'lucide-react';
import { SHAADI_PHONE, SHAADI_PHONE_DISPLAY, shaadiWhatsAppLink } from '@/lib/shaadiContact';
import { VenueFilterList, type LocalityVenue } from '@/components/venues/VenueFilterList';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';
const PAGE_URL = `${BASE_URL}/venues/patna/saguna-mor`;
const SHAADI_WA = shaadiWhatsAppLink('Hi, I am looking for a wedding venue in Saguna Mor, Patna. Please help.');

export const metadata: Metadata = {
  title: 'Banquet Halls in Saguna Mor, Patna — Verified Venues & Pricing | ShaadiShopping',
  description:
    'Looking for a banquet hall in Saguna Mor, Patna? Compare verified venues like 7 Vachan — real pricing from ₹1,100/plate, in-house DJ, rooftop option, capacity 500+ guests. Free consultation with a ShaadiShopping Wedding Expert.',
  keywords: [
    'banquet hall saguna mor',
    'wedding venue saguna mor patna',
    'marriage hall saguna mor',
    'saguna mor wedding hall',
    'wedding venues danapur khagaul road',
    '7 vachan patna',
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'Banquet Halls in Saguna Mor, Patna — Verified Venues & Pricing',
    description: 'Compare verified Saguna Mor wedding venues — real pricing, capacity, and photos. Get a free quote via ShaadiShopping.',
    url: PAGE_URL,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
  },
  robots: { index: true, follow: true },
};

const VENUES: LocalityVenue[] = [
  {
    name: '7 Vachan',
    tagline: 'Rated Venue with In-House DJ & Rooftop',
    area: 'Judges Colony, Saguna Mor, Danapur Khagaul Road',
    rating: 4.6,
    capacityLabel: '500+ guests',
    capacityMax: 501,
    vegPrice: 1100,
    nonVegPrice: 1300,
    rooms: '7 guest rooms',
    highlights: ['In-house DJ', 'Rooftop venue option', 'Play area for kids', 'Wheelchair accessible', 'Est. 2016'],
    href: '/lp/7-vachan-patna',
    image: 'https://content.jdmagicbox.com/v2/comp/patna/z3/0612px612.x612.250508092933.e8z3/catalogue/7-vachan-judges-colony-patna-banquet-halls-z4mw544mkw.jpg',
    imageAlt: '7 Vachan banquet hall, Judges Colony Saguna Mor Patna',
  },
];

const FAQS = [
  {
    q: 'What is the average wedding budget for a venue in Saguna Mor?',
    a: 'Saguna Mor venues typically charge ₹1,100–₹1,300 per plate all-inclusive, in line with Patna\'s overall ₹999–₹1,600/plate range. For a 300–500 guest wedding, expect venue and catering together to run roughly ₹6–13 lakh; total wedding budgets in Patna commonly fall between ₹5 lakh and ₹50 lakh depending on guest count and services.',
  },
  {
    q: 'How many guests can Saguna Mor banquet halls accommodate?',
    a: '7 Vachan, the established venue in Saguna Mor, accommodates 500+ guests. As always, confirm the seated dinner capacity separately from the headline event-floor figure before booking.',
  },
  {
    q: 'What makes Saguna Mor different from Danapur?',
    a: 'Saguna Mor sits just down Danapur Khagaul Road from Danapur proper and has emerged as a newer wedding zone with more recently built venues. 7 Vachan, for instance, offers an in-house DJ and a rooftop venue option — amenities more common in newer construction than in older, established halls.',
  },
  {
    q: 'Is Saguna Mor accessible for elderly or differently-abled guests?',
    a: '7 Vachan is wheelchair accessible, which is worth confirming directly with any venue if you have elderly relatives or guests with mobility needs attending.',
  },
  {
    q: 'Do Saguna Mor venues offer accommodation for outstation guests?',
    a: '7 Vachan offers 7 on-site guest rooms — useful if family is travelling in from outside Patna for the wedding.',
  },
];

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Venues', item: `${BASE_URL}/venues/patna` },
    { '@type': 'ListItem', position: 3, name: 'Patna', item: `${BASE_URL}/venues/patna` },
    { '@type': 'ListItem', position: 4, name: 'Saguna Mor', item: PAGE_URL },
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
  name: '7 Vachan',
  image: VENUES[0].image,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Judges Colony, Saguna Mor, Danapur Khagaul Road',
    addressLocality: 'Patna',
    addressRegion: 'Bihar',
    addressCountry: 'IN',
  },
  priceRange: '₹1,100–₹1,300 per plate',
  aggregateRating: { '@type': 'AggregateRating', ratingValue: VENUES[0].rating, reviewCount: 55 },
  url: `${BASE_URL}/lp/7-vachan-patna`,
};

export default function SagunaMorVenuesPage() {
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
              <span className="text-[#C5A46D]">Saguna Mor</span>
            </nav>

            <div className="inline-flex items-center gap-2 bg-[#C5A46D]/15 border border-[#C5A46D]/30 text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full mb-5">
              <MapPin className="w-3 h-3" /> Saguna Mor, Patna
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-5" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Banquet Halls in Saguna Mor, Patna
            </h1>
            <p className="text-white/65 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-8">
              An emerging wedding zone along Danapur Khagaul Road — newer venues, competitive pricing, verified by our Patna team.
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
              Saguna Mor sits just down Danapur Khagaul Road from Danapur proper, and over the last several years it has
              grown into one of Patna&apos;s newer wedding destinations. Because much of the construction here is more
              recent than in the city&apos;s older wedding belts, venues in Saguna Mor tend to come with amenities that
              weren&apos;t standard a decade ago — in-house DJ setups, rooftop function spaces, and dedicated play areas
              for children among the family functions.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Average venue budgets.</strong> Banquet halls in Saguna Mor typically
              charge ₹1,100–₹1,300 per plate all-inclusive — hall, catering, and basic décor together — comfortably
              within Patna&apos;s overall ₹999–₹1,600 per-plate range. For a wedding of 300–500 guests, venue and
              catering costs usually add up to roughly ₹6–13 lakh; across every function, most Patna families budget
              somewhere between ₹5 lakh and ₹50 lakh in total depending on guest count and the scale of décor and
              entertainment.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Best guest capacities.</strong> Venues here are generally built for
              500+ guests, which suits the scale of a typical multi-day Bihari wedding. As with any hall in Patna, treat
              the advertised capacity as an event-floor figure rather than a seated-dinner number — always ask the venue
              for its actual seated dinner capacity before finalising your guest list against it.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Parking and accessibility.</strong> Danapur Khagaul Road is still a
              developing corridor, so infrastructure varies more block to block than in Patna&apos;s older, more settled
              wedding areas. It&apos;s worth confirming a venue&apos;s dedicated parking count directly rather than
              assuming — though on the plus side, some newer venues here, including 7 Vachan, have been built with
              wheelchair accessibility in mind, which is genuinely useful if you have elderly or differently-abled
              guests attending.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Nearby wedding shopping.</strong> Like Danapur, Saguna Mor is primarily
              a venue and residential corridor. For lehengas, jewellery, and wedding invitations, most families here
              travel into central Patna, where Boring Road and Bailey Road remain the city&apos;s two go-to
              wedding-shopping destinations.
            </p>
          </div>
        </section>

        {/* ── VENUES + FILTERS ── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 sm:pb-20">
          <div className="text-center mb-8">
            <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-2">Verified & Trusted</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#2A1F1B]" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Verified Wedding Venues in Saguna Mor
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
                { name: 'Danapur', href: '/venues/patna/danapur', desc: 'Just up Danapur Khagaul Road — Patna\'s most active wedding corridor.' },
                { name: 'All Patna Venues', href: '/venues/patna', desc: 'Compare every verified venue we list across Patna.' },
                { name: 'Bailey Road', href: '/venues/patna/bailey-road', desc: 'Patna\'s premier shopping corridor for wedding essentials.' },
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
              Saguna Mor Wedding Venues — FAQ
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
              Book a Venue in Saguna Mor — Free Consultation
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
