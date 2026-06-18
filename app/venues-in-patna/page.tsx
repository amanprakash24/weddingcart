import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { JsonLd } from '@/components/JsonLd';
import { Star, MapPin, Users, CheckCircle, ChevronRight, Phone } from 'lucide-react';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';
const PAGE_URL = `${BASE_URL}/venues-in-patna`;
const SHAADI_PHONE = '+917986519662';
const SHAADI_PHONE_DISPLAY = '+91 79865 19662';
const SHAADI_WA = `https://wa.me/${SHAADI_PHONE}?text=Hi%2C%20I%20am%20looking%20for%20a%20wedding%20venue%20in%20Patna.%20Please%20help.`;

export const metadata: Metadata = {
  title: 'Wedding Venues in Patna — Compare & Book Top Halls (2025) | ShaadiShopping',
  description:
    'Find the best wedding venues in Patna. Compare verified banquet halls — Touch of Cozy (Rajeev Nagar), Swayamvar Hall (Danapur) & 7 Vachan (Saguna Mor). Real pricing, photos & free quotes. Book via ShaadiShopping.',
  keywords: [
    'venues in patna',
    'wedding venues in patna',
    'banquet halls in patna',
    'best wedding venues patna 2025',
    'marriage hall patna',
    'wedding hall patna',
    'banquet hall booking patna',
    'shaadi venues patna',
    'reception venues patna',
    'event venues patna',
    'compare wedding venues patna',
    'affordable wedding venues patna',
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'Wedding Venues in Patna — Compare & Book Top Halls (2025)',
    description:
      'Compare Patna\'s top verified wedding venues — pricing, photos, capacity & features. Touch of Cozy, Swayamvar Hall, 7 Vachan. Get a free quote via ShaadiShopping.',
    url: PAGE_URL,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wedding Venues in Patna — Compare & Book (2025)',
    description: 'Compare top banquet halls in Patna with real pricing, photos & capacity. Get a free quote via ShaadiShopping.',
  },
  robots: { index: true, follow: true },
};

const VENUES = [
  {
    name: 'Touch of Cozy',
    tagline: 'All-in-One Venue with Café & Guest Stay',
    area: 'Mica Colony, Rajeev Nagar',
    rating: 5.0,
    reviewLabel: 'Top Rated',
    capacity: 'Up to 200 guests',
    vegPrice: 999,
    nonVegPrice: 1199,
    rooms: '5 guest rooms',
    highlights: ['In-house café', 'FSSAI certified kitchen', 'Valet parking (40 cars)', 'Baraat permitted', 'GST registered'],
    badge: 'New · Rajeev Nagar',
    badgeColor: 'bg-[#C5A46D]',
    href: '/lp/touch-of-cozy',
    image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80',
    imageAlt: 'Touch of Cozy banquet hall, Mica Colony Rajeev Nagar Patna',
  },
  {
    name: 'Swayamvar Hall & Homestay',
    tagline: 'Large-Capacity Hall with Home Stay',
    area: 'Gola Road, near Chanakya Puri, Danapur',
    rating: 4.8,
    reviewLabel: '500+ events hosted',
    capacity: 'Up to 500 guests',
    vegPrice: 1000,
    nonVegPrice: 1300,
    rooms: 'Home stay available',
    highlights: ['AC banquet hall', 'In-house catering & décor', 'Stage & sound setup', 'Power backup', '10+ years experience'],
    badge: 'Trusted · Danapur',
    badgeColor: 'bg-[#8B1A4A]',
    href: '/lp/swayamvar-hall',
    image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80',
    imageAlt: 'Swayamvar Hall banquet hall, Danapur Patna',
  },
  {
    name: '7 Vachan',
    tagline: 'Rated Venue with In-House DJ & Rooftop',
    area: 'Judges Colony, Saguna Mor, Danapur Khagaul Road',
    rating: 4.6,
    reviewLabel: '55 reviews',
    capacity: '500+ guests',
    vegPrice: 1100,
    nonVegPrice: 1300,
    rooms: '7 guest rooms',
    highlights: ['In-house DJ', 'Rooftop venue option', 'Play area for kids', 'Wheelchair accessible', 'Est. 2016'],
    badge: '4.6★ · Saguna Mor',
    badgeColor: 'bg-[#C5A46D]',
    href: '/lp/7-vachan-patna',
    image: 'https://content.jdmagicbox.com/v2/comp/patna/z3/0612px612.x612.250508092933.e8z3/catalogue/7-vachan-judges-colony-patna-banquet-halls-z4mw544mkw.jpg',
    imageAlt: '7 Vachan banquet hall, Judges Colony Saguna Mor Patna',
  },
];

const FAQS = [
  {
    q: 'How much does a wedding venue cost in Patna?',
    a: 'Wedding venues in Patna typically charge ₹999–₹1,600 per plate all-inclusive (hall + catering + basic décor). Budget-friendly options like Touch of Cozy start at ₹999/plate. Premium options with luxury décor and large capacity run ₹1,400–₹1,800/plate.',
  },
  {
    q: 'Which is the best area in Patna for a wedding venue?',
    a: 'Rajeev Nagar is ideal for intimate weddings with modern venues. Danapur (Gola Road) is great for large baraats and multi-day functions. Judges Colony / Saguna Mor offers newer venues with competitive pricing and in-house DJ.',
  },
  {
    q: 'How far in advance should I book a venue in Patna?',
    a: 'For November–January (peak muhurat season), book 4–8 months in advance. Popular venues like Touch of Cozy and 7 Vachan fill up fast. Off-season (March–July) offers more flexibility.',
  },
  {
    q: 'Do venues in Patna include catering?',
    a: 'Most banquet halls in Patna offer in-house catering. Touch of Cozy, Swayamvar Hall, and 7 Vachan all include in-house catering. Confirm whether outside caterers are allowed if you have a preferred vendor.',
  },
  {
    q: 'Which Patna venues offer guest rooms for outstation family?',
    a: 'Touch of Cozy offers 5 complimentary guest rooms, 7 Vachan has 7 guest rooms, and Swayamvar Hall offers a home stay option — all three are ideal if you have family travelling from outside Patna.',
  },
  {
    q: 'How do I book a venue through ShaadiShopping?',
    a: 'Visit any venue\'s page on ShaadiShopping, fill in the free quote form, or WhatsApp us directly. Our Patna team responds within 30 minutes with availability, pricing, and a site visit appointment if needed.',
  },
];

const itemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Best Wedding Venues in Patna',
  description: 'Top verified wedding and banquet venues in Patna, Bihar — curated by ShaadiShopping.',
  url: PAGE_URL,
  numberOfItems: VENUES.length,
  itemListElement: VENUES.map((v, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: v.name,
    url: `${BASE_URL}${v.href}`,
  })),
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Wedding Venues in Patna', item: PAGE_URL },
  ],
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

export default function VenuesInPatnaPage() {
  return (
    <>
      <JsonLd data={itemListSchema} />
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      <div className="min-h-screen bg-[#FFFAF5]">

        {/* ── HERO ── */}
        <section className="relative bg-[#1C1208] overflow-hidden">
          <div className="absolute inset-0 opacity-30">
            <Image
              src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1600&q=80"
              alt="Wedding venues in Patna"
              fill
              className="object-cover"
              priority
              sizes="100vw"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-[#1C1208]/80 via-[#1C1208]/70 to-[#1C1208]" />

          <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
            {/* Breadcrumb */}
            <nav className="flex items-center justify-center gap-2 text-[#C5A46D]/60 text-xs mb-6">
              <Link href="/" className="hover:text-[#C5A46D] transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-[#C5A46D]">Wedding Venues in Patna</span>
            </nav>

            <div className="inline-flex items-center gap-2 bg-[#C5A46D]/15 border border-[#C5A46D]/30 text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full mb-5">
              <MapPin className="w-3 h-3" /> Patna, Bihar · 3 Verified Venues
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-5" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Wedding Venues in Patna<br />
              <span style={{ background: 'linear-gradient(135deg, #e8d5b0, #C5A46D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Compare & Book — 2025
              </span>
            </h1>
            <p className="text-white/65 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-8">
              ShaadiShopping personally verifies every venue we list. Real photos, honest pricing, and a dedicated consultant — so you book with confidence, not guesswork.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
              {[
                { value: '3', label: 'Verified Venues' },
                { value: '₹999', label: 'Starting Per Plate' },
                { value: '500+', label: 'Max Capacity' },
                { value: '30 min', label: 'Response Time' },
              ].map(({ value, label }) => (
                <div key={label} className="text-center px-4">
                  <p className="text-2xl font-light text-[#C5A46D]" style={{ fontFamily: 'var(--font-playfair, serif)' }}>{value}</p>
                  <p className="text-white/40 text-[0.65rem] uppercase tracking-[0.15em] mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={SHAADI_WA}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold px-7 py-4 rounded-full text-sm shadow-lg hover:opacity-90 transition-all"
              >
                WhatsApp Us — Free Quote
              </a>
              <a
                href={`tel:${SHAADI_PHONE}`}
                className="inline-flex items-center justify-center gap-2 border border-[#C5A46D]/40 text-[#C5A46D] font-semibold px-7 py-4 rounded-full text-sm hover:bg-[#C5A46D]/10 transition-all"
              >
                <Phone className="w-4 h-4" /> {SHAADI_PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </section>

        {/* ── VENUE CARDS ── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="text-center mb-10">
            <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-2">Verified & Trusted</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#2A1F1B]" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Top Wedding Venues in Patna
            </h2>
            <p className="text-gray-500 text-sm mt-2 max-w-xl mx-auto">
              Every venue below has been visited and verified by our Patna team. Pricing and features are accurate as of 2025.
            </p>
          </div>

          <div className="space-y-8">
            {VENUES.map((venue, idx) => (
              <div key={venue.name} className="bg-white rounded-3xl overflow-hidden border border-[#C5A46D]/15 shadow-sm hover:shadow-lg transition-shadow duration-300">
                <div className="grid md:grid-cols-5 gap-0">

                  {/* Image */}
                  <div className="relative md:col-span-2 aspect-[4/3] md:aspect-auto min-h-[220px]">
                    <Image
                      src={venue.image}
                      alt={venue.imageAlt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 40vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <span className={`absolute top-3 left-3 text-[9px] font-bold uppercase tracking-[0.2em] ${venue.badgeColor} text-white px-2.5 py-1 rounded-full`}>
                      {venue.badge}
                    </span>
                    <span className="absolute top-3 right-3 bg-white/95 text-[#2A1F1B] text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3 fill-[#C5A46D] text-[#C5A46D]" /> {venue.rating}
                    </span>
                    <div className="absolute bottom-3 left-3 right-3 text-white text-[10px] font-medium opacity-80">
                      #{idx + 1} on ShaadiShopping
                    </div>
                  </div>

                  {/* Details */}
                  <div className="md:col-span-3 p-6 flex flex-col justify-between">
                    <div>
                      <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.15em] mb-1">{venue.tagline}</p>
                      <h3 className="text-xl sm:text-2xl font-bold text-[#2A1F1B] mb-2" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                        {venue.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-4">
                        <MapPin className="w-3.5 h-3.5 text-[#C5A46D] flex-shrink-0" />
                        <span>{venue.area}</span>
                        <span className="text-gray-300 mx-1">·</span>
                        <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span>{venue.capacity}</span>
                      </div>

                      {/* Pricing */}
                      <div className="flex gap-4 mb-4">
                        <div className="bg-[#FAF5EE] border border-[#C5A46D]/20 rounded-xl px-4 py-3">
                          <p className="text-[9px] text-gray-400 uppercase tracking-[0.12em] mb-0.5">Veg / plate</p>
                          <p className="text-[#8B1A4A] font-bold text-lg">₹{venue.vegPrice.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="bg-[#FAF5EE] border border-[#C5A46D]/20 rounded-xl px-4 py-3">
                          <p className="text-[9px] text-gray-400 uppercase tracking-[0.12em] mb-0.5">Non-Veg / plate</p>
                          <p className="text-[#8B1A4A] font-bold text-lg">₹{venue.nonVegPrice.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="bg-[#FAF5EE] border border-[#C5A46D]/20 rounded-xl px-4 py-3">
                          <p className="text-[9px] text-gray-400 uppercase tracking-[0.12em] mb-0.5">Stay</p>
                          <p className="text-[#2A1F1B] font-semibold text-sm mt-1">{venue.rooms}</p>
                        </div>
                      </div>

                      {/* Features */}
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {venue.highlights.map((h) => (
                          <span key={h} className="flex items-center gap-1 text-[10px] bg-[#FAF5EE] text-[#6B5B4D] border border-[#E8D4A0]/50 px-2 py-1 rounded-full">
                            <CheckCircle className="w-2.5 h-2.5 text-[#C5A46D] flex-shrink-0" /> {h}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link
                        href={venue.href}
                        className="flex-1 flex items-center justify-center gap-2 bg-[#8B1A4A] text-white font-bold py-3.5 rounded-xl text-sm hover:opacity-90 transition-all"
                        style={{ boxShadow: '0 4px 16px rgba(139,26,74,0.3)' }}
                      >
                        View Venue & Book <ChevronRight className="w-4 h-4" />
                      </Link>
                      <a
                        href={SHAADI_WA}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 border border-[#C5A46D]/40 text-[#8B1A4A] font-semibold px-5 py-3.5 rounded-xl text-sm hover:bg-[#8B1A4A]/5 transition-all"
                      >
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── COMPARISON TABLE ── */}
        <section className="bg-white border-y border-[#C5A46D]/15 py-14 sm:py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-2">Side by Side</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#2A1F1B]" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                Compare Patna Wedding Venues
              </h2>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-[#C5A46D]/20">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#2A1F1B] text-[#C5A46D]">
                  <tr>
                    {['Venue', 'Area', 'Rating', 'Veg / Plate', 'Non-Veg / Plate', 'Rooms', 'Capacity'].map((h) => (
                      <th key={h} className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#C5A46D]/10">
                  {[
                    { name: 'Touch of Cozy', area: 'Rajeev Nagar', rating: '5.0★', veg: '₹999', nonVeg: '₹1,199', rooms: '5 rooms', cap: '200', href: '/lp/touch-of-cozy' },
                    { name: 'Swayamvar Hall', area: 'Danapur', rating: '4.8★', veg: '₹1,000', nonVeg: '₹1,300', rooms: 'Home stay', cap: '500', href: '/lp/swayamvar-hall' },
                    { name: '7 Vachan', area: 'Saguna Mor', rating: '4.6★', veg: '₹1,100', nonVeg: '₹1,300', rooms: '7 rooms', cap: '500+', href: '/lp/7-vachan-patna' },
                  ].map((row, i) => (
                    <tr key={row.name} className={i % 2 === 0 ? 'bg-[#FFFAF5]' : 'bg-white'}>
                      <td className="px-4 py-4 font-semibold text-[#2A1F1B]">
                        <Link href={row.href} className="hover:text-[#8B1A4A] transition-colors">{row.name}</Link>
                      </td>
                      <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{row.area}</td>
                      <td className="px-4 py-4 text-[#C5A46D] font-bold whitespace-nowrap">{row.rating}</td>
                      <td className="px-4 py-4 text-[#8B1A4A] font-semibold whitespace-nowrap">{row.veg}</td>
                      <td className="px-4 py-4 text-[#8B1A4A] font-semibold whitespace-nowrap">{row.nonVeg}</td>
                      <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{row.rooms}</td>
                      <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{row.cap}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-gray-400 text-xs mt-3 text-center">Prices are per plate and include hall, basic décor, and in-house catering. Confirm exact packages with each venue.</p>
          </div>
        </section>

        {/* ── AREA GUIDE ── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="text-center mb-10">
            <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-2">City Guide</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#2A1F1B]" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Best Areas for Wedding Venues in Patna
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              {
                area: 'Rajeev Nagar / Mica Colony',
                desc: 'A fast-growing belt with newer, well-maintained venues. Best for intimate weddings (under 250 guests) with modern setups. Excellent road access via Atal Path.',
                venues: ['Touch of Cozy'],
                links: ['/lp/touch-of-cozy'],
                price: 'From ₹999/plate',
              },
              {
                area: 'Danapur / Gola Road',
                desc: "Patna's most active wedding corridor. Large halls that handle 500+ guest baraats with ease. Multi-day functions, home stay accommodation, and experienced teams.",
                venues: ['Swayamvar Hall & Homestay'],
                links: ['/lp/swayamvar-hall'],
                price: 'From ₹1,000/plate',
              },
              {
                area: 'Judges Colony / Saguna Mor',
                desc: 'Emerging wedding zone along Danapur Khagaul Road. Newer venues with competitive pricing, in-house DJ, rooftop options, and guest rooms.',
                venues: ['7 Vachan'],
                links: ['/lp/7-vachan-patna'],
                price: 'From ₹1,100/plate',
              },
            ].map(({ area, desc, venues, links, price }) => (
              <div key={area} className="bg-white rounded-2xl border border-[#C5A46D]/15 p-6">
                <h3 className="font-bold text-[#2A1F1B] text-base mb-2" style={{ fontFamily: 'var(--font-playfair, serif)' }}>{area}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4">{desc}</p>
                <p className="text-[#C5A46D] text-xs font-semibold mb-3">{price}</p>
                <div className="space-y-1">
                  {venues.map((v, i) => (
                    <Link key={v} href={links[i]} className="flex items-center gap-2 text-[#8B1A4A] text-xs font-semibold hover:underline">
                      <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" /> {v}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CHECKLIST ── */}
        <section className="bg-[#2A1F1B] py-14 sm:py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-2">Before You Book</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
                Venue Checklist — 8 Things to Verify
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                ['Seated dinner capacity', 'Ask for dinner capacity, not just standing. A "500 guest" hall often seats 300 at dinner.'],
                ['Per-plate pricing breakdown', 'Confirm what\'s included — hall + catering + décor, or hall-only. All-inclusive is safer.'],
                ['Generator backup', 'Ask if backup covers AC, lights, and sound — or only partial. Patna summers are brutal.'],
                ['Catering policy', 'Many halls allow only in-house caterers. Confirm before booking if you have a preferred vendor.'],
                ['Parking capacity', 'A hall without parking creates chaos. Confirm vehicle count clearly — not just "ample parking".'],
                ['Outside alcohol / food policy', 'Know the rules before you book, especially for alcohol. Many Patna halls are alcohol-free.'],
                ['Muhurat date availability', 'Peak Nov–Jan muhurats book 6–8 months ahead. Lock your date as soon as it\'s confirmed.'],
                ['Guest rooms for outstation family', 'Venues like Touch of Cozy (5 rooms), 7 Vachan (7 rooms) and Swayamvar Hall offer on-site stay.'],
              ].map(([title, detail], i) => (
                <div key={title} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-4">
                  <span className="w-6 h-6 rounded-full bg-[#C5A46D]/20 text-[#C5A46D] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <div>
                    <p className="text-white font-semibold text-sm mb-0.5">{title}</p>
                    <p className="text-white/45 text-xs leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="text-center mb-10">
            <p className="text-[#C5A46D] text-[0.65rem] font-bold uppercase tracking-[0.2em] mb-2">Common Questions</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#2A1F1B]" style={{ fontFamily: 'var(--font-playfair, serif)' }}>
              Wedding Venues in Patna — FAQ
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
              Book a Venue in Patna — Free Consultation
            </h2>
            <p className="text-white/65 text-sm mb-8 max-w-xl mx-auto">
              Our Patna team visits every venue, negotiates pricing on your behalf, and responds within 30 minutes. No hidden charges. No spam.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={SHAADI_WA}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold px-8 py-4 rounded-full text-sm shadow-lg hover:opacity-90 transition-all"
              >
                WhatsApp for Free Quote
              </a>
              <a
                href={`tel:${SHAADI_PHONE}`}
                className="inline-flex items-center justify-center gap-2 border-2 border-white/30 text-white font-semibold px-8 py-4 rounded-full text-sm hover:bg-white/10 transition-all"
              >
                <Phone className="w-4 h-4" /> {SHAADI_PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </section>

        {/* ── FOOTER NOTE ── */}
        <div className="bg-[#1C1208] py-5 text-center">
          <p className="text-gray-600 text-xs">
            © {new Date().getFullYear()} ShaadiShopping · Patna&apos;s Trusted Wedding Planning Platform ·{' '}
            <Link href="/" className="text-[#C5A46D]/60 hover:text-[#C5A46D] transition-colors">Visit Main Site</Link>
            {' · '}
            <Link href="/blog/best-banquet-hall-in-patna" className="text-[#C5A46D]/60 hover:text-[#C5A46D] transition-colors">Banquet Hall Guide</Link>
          </p>
        </div>

      </div>
    </>
  );
}
