import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, ChevronRight, Phone, MessageCircle } from 'lucide-react';
import { connectDB } from '@/lib/mongodb';
import VendorModel from '@/lib/models/Vendor';
import { JsonLd } from '@/components/JsonLd';
import VendorCard from '@/components/VendorCard';
import type { Vendor } from '@/types';

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

const CITIES: Record<string, { name: string; state: string }> = {
  patna:     { name: 'Patna',     state: 'Bihar' },
  delhi:     { name: 'Delhi',     state: 'Delhi' },
  mumbai:    { name: 'Mumbai',    state: 'Maharashtra' },
  jaipur:    { name: 'Jaipur',   state: 'Rajasthan' },
  bangalore: { name: 'Bangalore', state: 'Karnataka' },
  chennai:   { name: 'Chennai',   state: 'Tamil Nadu' },
  hyderabad: { name: 'Hyderabad', state: 'Telangana' },
  kolkata:   { name: 'Kolkata',   state: 'West Bengal' },
  udaipur:   { name: 'Udaipur',   state: 'Rajasthan' },
  goa:       { name: 'Goa',       state: 'Goa' },
};

const CATEGORIES: Record<string, { name: string; plural: string; desc: string; priceNote: string }> = {
  venue:        { name: 'Wedding Venue',            plural: 'Wedding Venues',            desc: 'banquet halls, garden lawns, farmhouses & marriage gardens', priceNote: 'Venue rental from ₹80,000' },
  makeup:       { name: 'Bridal Makeup Artist',     plural: 'Bridal Makeup Artists',     desc: 'HD, airbrush & traditional bridal makeup artists',           priceNote: 'Packages from ₹15,000' },
  mehndi:       { name: 'Mehndi Artist',            plural: 'Mehndi Artists',            desc: 'bridal mehndi, Arabic & Rajasthani henna artists',           priceNote: 'Packages from ₹8,000' },
  decorator:    { name: 'Wedding Decorator',        plural: 'Wedding Decorators',        desc: 'floral, themed & LED wedding decorators',                   priceNote: 'Packages from ₹50,000' },
  band:         { name: 'Wedding Band',             plural: 'Wedding Bands',             desc: 'baraat bands, brass bands & dhol ensembles',                priceNote: 'Packages from ₹25,000' },
  dj:           { name: 'Wedding DJ',               plural: 'Wedding DJs',               desc: 'professional DJs with LED rigs & sound systems',            priceNote: 'Packages from ₹15,000' },
  catering:     { name: 'Wedding Caterer',          plural: 'Wedding Caterers',          desc: 'veg, non-veg & multi-cuisine catering services',            priceNote: 'From ₹450/plate' },
  'photo-video':{ name: 'Wedding Photographer',     plural: 'Wedding Photographers',     desc: 'candid, traditional & pre-wedding shoot photographers',      priceNote: 'Packages from ₹50,000' },
  planning:     { name: 'Wedding Planner',          plural: 'Wedding Planners',          desc: 'full-service, partial & day-of wedding planners',           priceNote: 'From ₹50,000' },
};

// Patna-specific city+category FAQs (primary market)
const PATNA_FAQS: Record<string, { q: string; a: string }[]> = {
  venue: [
    { q: 'What are the best wedding venues in Patna?', a: 'Top wedding venues in Patna include luxury hotels like Hotel Chanakya and Patliputra Ashok, grand banquet halls on Bailey Road, convention centres like Vaishali Convention Hall (2,000 guests), and garden lawns in Phulwari Sharif and Saguna More. ShaadiShopping lists 35+ verified Patna venues.' },
    { q: 'How much does a wedding venue cost in Patna?', a: 'Wedding venue rental in Patna ranges from ₹80,000 for budget halls to ₹4 lakh+ for premium hotels. Bailey Road banquet halls typically cost ₹1–2.5 lakh per event for 400–700 guests.' },
    { q: 'How many guests can Patna wedding venues accommodate?', a: 'Patna venues range from 200 to 2,000 guests. Budget halls fit 200–400, mid-range banquets 400–700, and convention centres like Vaishali Convention Hall handle 2,000+ guests.' },
    { q: 'Which areas in Patna have the most wedding venues?', a: 'Bailey Road and Boring Road are the top venue corridors. Kankarbagh, Danapur, Phulwari Sharif, Rajendra Nagar, and Saguna More also have excellent halls and garden lawns.' },
    { q: 'Are there outdoor wedding venues in Patna?', a: 'Yes — Patna has multiple outdoor options including garden lawns at Saguna More, riverside lawns near the Ganga, farmhouses on Maner Road and Phulwari Sharif, and open grounds in Danapur and Khagaul.' },
  ],
  makeup: [
    { q: 'How much do bridal makeup artists charge in Patna?', a: 'Bridal makeup in Patna costs ₹15,000–₹45,000 for professional artists. HD airbrush makeup specialists charge ₹25,000–₹60,000. Most packages include the wedding day plus one pre-wedding occasion (sangeet or mehndi).' },
    { q: 'What makeup styles are popular for Patna brides?', a: 'Patna brides typically prefer traditional heavy bridal looks with gold jewellery, red/maroon lehenga tones, and strong eye makeup for the wedding ceremony. Lighter, dewy looks are popular for sangeet and mehndi nights.' },
    { q: 'How early should I book a bridal makeup artist in Patna?', a: 'Book at least 4–6 months before your wedding. Top Patna makeup artists are booked 6–12 months in advance during peak season (November–February).' },
  ],
  mehndi: [
    { q: 'How much do mehndi artists charge in Patna?', a: 'Bridal mehndi in Patna costs ₹8,000–₹25,000 for full bridal coverage (hands + feet). Guest mehndi packages start from ₹5,000 for 10–15 guests. Arabic and Rajasthani designs are most popular.' },
    { q: 'When should mehndi be applied before a Patna wedding?', a: 'Apply mehndi 2–3 days before the wedding for the colour to fully develop. Most Patna families schedule the mehndi ceremony 2 nights before the wedding.' },
    { q: 'What mehndi styles are popular at Patna weddings?', a: 'Arabic floral patterns and Rajasthani dense designs are most popular at Patna weddings. Many brides also opt for Indo-Arabic fusion designs that combine flowing motifs with intricate coverage.' },
  ],
  catering: [
    { q: 'How much does wedding catering cost per plate in Patna?', a: 'Wedding catering in Patna costs ₹450–₹700 for vegetarian thali and ₹600–₹950 for non-vegetarian menus. Premium multi-cuisine buffets with live counters cost ₹800–₹1,200 per plate.' },
    { q: 'What food is served at weddings in Patna?', a: 'Patna weddings typically feature traditional Bihari cuisine (litti chokha, sattu paratha, dal puri, kheer) alongside Mughlai, North Indian, and Chinese options. Live chaat and dessert counters are very popular.' },
    { q: 'How many caterers do I need for a 500-guest Patna wedding?', a: 'For 500 guests, plan for 1 head chef + 4–5 cooks + 20–25 serving staff. Most Patna catering companies provide complete staff packages. Request a site survey to estimate exact requirements.' },
  ],
  'photo-video': [
    { q: 'How much does wedding photography cost in Patna?', a: 'Wedding photography in Patna ranges from ₹35,000–₹80,000 for local photographers to ₹1–2 lakh for experienced candid photographers. Combined photo+video packages typically cost ₹70,000–₹1.5 lakh.' },
    { q: 'What pre-wedding shoot locations are popular in Patna?', a: 'Top pre-wedding shoot locations near Patna include Ganga Ghat (sunrise shots), Gandhi Maidan, Eco Park, Nalanda ruins (60 km away), Rajgir hills, and the Gandhi Setu bridge at sunset.' },
    { q: 'How long before the wedding should I book a photographer in Patna?', a: 'Book at least 3–6 months in advance. The best Patna wedding photographers are booked 6–9 months ahead, especially for weekend dates from November to February.' },
  ],
  decorator: [
    { q: 'How much does wedding decoration cost in Patna?', a: 'Wedding decoration in Patna ranges from ₹60,000 for basic floral setups to ₹3 lakh+ for elaborate themed décor with LED walls, draping, and fresh flowers. Sangeet night decorations typically cost ₹40,000–₹1 lakh.' },
    { q: 'What wedding decoration themes are popular in Patna?', a: 'Popular wedding themes in Patna include Royal Rajasthani (deep reds & gold), Floral Garden (pastel roses & marigold), Traditional Bihari (marigold strings, earthen pots, tribal motifs), Minimalist White, and Glam LED setups.' },
    { q: 'Do Patna decorators provide their own materials?', a: 'Yes — most Patna wedding decorators supply all materials including fresh flowers, fabric draping, furniture, LED lighting, and stage props. Always confirm what is included in the quoted package.' },
  ],
  band: [
    { q: 'How much does a baraat band cost in Patna?', a: 'Baraat bands in Patna charge ₹25,000–₹60,000 per event depending on the number of musicians (typically 15–35 players) and performance duration. LED-lit bands with costume performers charge more.' },
    { q: 'What music do Patna baraat bands play?', a: 'Patna baraat bands play a mix of Bhojpuri folk songs, Bollywood hits, and traditional wedding melodies. Many bands also perform patriotic songs and classical pieces during the baraat procession.' },
    { q: 'How far in advance should I book a wedding band in Patna?', a: 'Book baraat bands at least 2–3 months before your wedding. November–February is peak season in Patna and top bands get booked 4–6 months in advance during auspicious muhurat dates.' },
  ],
  dj: [
    { q: 'How much does a wedding DJ cost in Patna?', a: 'Wedding DJs in Patna charge ₹15,000–₹40,000 per event. DJs with full LED rigs, laser lights, and fog machines charge ₹25,000–₹60,000. Confirm equipment details before booking.' },
    { q: 'Should I hire a DJ or a live band for my Patna wedding?', a: 'Most Patna couples hire both — a baraat band for the groom\'s procession and a DJ for the reception and sangeet night. The DJ provides musical variety and keeps the dance floor energetic throughout the evening.' },
  ],
  planning: [
    { q: 'How much do wedding planners charge in Patna?', a: 'Wedding planners in Patna charge ₹50,000–₹2 lakh for full-service packages, or 8–12% of the total wedding budget. Day-of coordinators are available from ₹25,000–₹50,000.' },
    { q: 'Do I need a wedding planner for a Patna wedding?', a: 'For weddings with 500+ guests or multi-day celebrations (tilak, mehndi, sangeet, wedding, reception), a full-service planner saves time and money through vendor discounts and seamless coordination.' },
  ],
};

function defaultFaqs(cat: { plural: string; name: string }, city: { name: string; state: string }) {
  return [
    {
      q: `How much do ${cat.plural} cost in ${city.name}?`,
      a: `Pricing for ${cat.plural} in ${city.name} varies based on experience, package inclusions, and event duration. Browse ShaadiShopping's verified ${city.name} listings to compare packages and request free quotes.`,
    },
    {
      q: `How far in advance should I book a ${cat.name} in ${city.name}?`,
      a: `Book ${cat.plural} in ${city.name} at least 3–6 months in advance. During peak wedding season (October–February), top vendors are booked 6–12 months ahead. Check availability early to secure your preferred vendor.`,
    },
    {
      q: `Are ${cat.plural} on ShaadiShopping verified?`,
      a: `Yes — all ${cat.plural} listed on ShaadiShopping are verified vendors. You can compare packages, read reviews, and get free quotes through the platform without any booking fees.`,
    },
    {
      q: `Can I find both budget and premium ${cat.plural} in ${city.name} on ShaadiShopping?`,
      a: `Yes — ShaadiShopping lists ${cat.plural} across all price ranges in ${city.name}, ${city.state}. Use the filters to search by price, rating, and location to find the best match for your wedding budget.`,
    },
  ];
}

function editorialText(cat: { plural: string; name: string; desc: string }, city: { name: string; state: string }): string {
  if (city.name === 'Patna') {
    const texts: Record<string, string> = {
      venue: `Patna, the capital of Bihar, is home to a thriving wedding industry with over 35 verified wedding venues listed on ShaadiShopping. From grand convention centres on Bailey Road that accommodate 2,000+ guests, to intimate garden lawns in Phulwari Sharif and riverside properties along the Ganga, Patna offers wedding venues for every budget and style. The peak wedding season runs from October to February, coinciding with the most auspicious muhurat dates in the Hindu calendar. ShaadiShopping is Bihar's most trusted wedding vendor platform — browse real photos, compare packages, and book directly.`,
      makeup: `Patna's bridal makeup artists blend traditional Bihari aesthetics with modern techniques to create looks that photograph beautifully and last the full wedding day. Whether you prefer heavy traditional bridal makeup with gold and red tones for the ceremony, or a lighter dewy look for the sangeet and mehndi nights, Patna's professional artists have the skills to deliver. All makeup artists on ShaadiShopping are verified with real portfolio photos and genuine client reviews.`,
      catering: `Wedding catering in Patna combines traditional Bihari flavours — litti chokha, sattu paratha, dal puri, and kheer — with popular Mughlai, North Indian, and Chinese cuisines to create memorable wedding feasts. Patna caterers are experienced in managing large-scale events from 200 to 3,000 guests, with complete staff, equipment, and service. Browse verified caterers on ShaadiShopping and request per-plate quotes for your guest count.`,
      'photo-video': `Wedding photographers in Patna capture the rich visual tapestry of Bihari wedding traditions — from the vibrant haldi and mehndi ceremonies to the emotional kanyadaan and joyful baraat. Many Patna photographers offer pre-wedding shoots at iconic locations like Ganga Ghat, Nalanda ruins, and Rajgir hills. ShaadiShopping lists verified photographers with full wedding galleries so you can assess their style before booking.`,
      decorator: `Wedding decorators in Patna transform marriage halls and lawns into breathtaking settings that reflect your personal style. Popular themes range from traditional Bihari setups with marigold strings and earthen motifs to grand Royal Rajasthani décor with deep reds and gold, and modern minimalist layouts with LED walls and fresh florals. All decorators on ShaadiShopping include real project photos so you can evaluate their work before committing.`,
      band: `The baraat is one of the most celebrated moments of a Bihari wedding, and Patna's brass bands bring unmatched energy to the groom's procession. Bands range from 15-piece ensembles to full 35-player orchestras with LED-lit instruments, costume dancers, and a repertoire spanning Bhojpuri folk songs, Bollywood hits, and classical melodies. ShaadiShopping lists verified Patna bands with pricing and availability.`,
      dj: `DJs in Patna are skilled at reading the crowd and keeping the dance floor alive from the sangeet night through to the reception. Most professional Patna DJs come equipped with top-tier sound systems, LED lighting rigs, laser effects, and fog machines. Combine a DJ with a baraat band for the ultimate Patna wedding entertainment experience — browse and book through ShaadiShopping.`,
      mehndi: `Mehndi is a cherished ritual at every Bihari wedding, and Patna's mehndi artists are known for their intricate Arabic and Rajasthani designs. Bridal mehndi sessions typically last 4–8 hours and are scheduled 2 days before the wedding for the colour to fully develop. ShaadiShopping lists verified Patna mehndi artists with real portfolio images and transparent pricing.`,
      planning: `Wedding planning in Patna requires coordinating dozens of vendors, logistics, and guest requirements across multiple days of celebration. A professional wedding planner saves time and money through vendor relationships, negotiated discounts, and seamless day-of coordination. ShaadiShopping partners with experienced Patna wedding planners for full-service and day-of packages.`,
    };
    return texts[cat.plural.toLowerCase().replace('wedding ', '')] || texts.venue || `${city.name} is home to talented ${cat.plural} experienced in creating memorable wedding celebrations. Browse and compare verified ${cat.plural} on ShaadiShopping.`;
  }

  return `${city.name}, ${city.state} has a vibrant wedding industry with experienced ${cat.plural} serving couples across the region. Whether you are planning an intimate celebration or a grand wedding, ShaadiShopping helps you compare verified ${cat.desc} in ${city.name}, read real reviews, and get free quotes — all in one place. Browse ${city.name}'s top ${cat.plural} below.`;
}

export function generateStaticParams() {
  return Object.keys(CITIES).flatMap((city) =>
    Object.keys(CATEGORIES).map((category) => ({ city, category }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; category: string }>;
}): Promise<Metadata> {
  const { city: citySlug, category: catSlug } = await params;
  const city = CITIES[citySlug];
  const cat = CATEGORIES[catSlug];
  if (!city || !cat) return { title: 'Not Found' };

  const title = `${cat.plural} in ${city.name}, ${city.state} — Book Top ${cat.plural} | ShaadiShopping`;
  const description = `Find the best ${cat.plural} in ${city.name}, ${city.state}. Compare verified ${cat.desc} with real packages, photos & pricing. ${cat.priceNote}. Get free quotes from top ${cat.plural} in ${city.name}.`;
  const url = `${BASE_URL}/cities/${citySlug}/${catSlug}`;

  // Non-Patna cities: noindex until we have real vendor listings there
  if (citySlug !== 'patna') {
    return {
      title,
      description,
      robots: { index: false, follow: false },
    };
  }

  return {
    title,
    description,
    alternates: { canonical: url },
    keywords: [
      `${cat.plural} in ${city.name}`, `${cat.plural} ${city.name}`,
      `wedding ${catSlug} ${city.name}`, `best ${cat.plural} ${city.name}`,
      `${cat.name} ${city.name} ${city.state}`, `book ${cat.plural} ${city.name}`,
    ],
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      locale: 'en_IN',
      siteName: 'ShaadiShopping',
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/opengraph-image'],
    },
  };
}

async function getVendors(cityName: string, catSlug: string): Promise<Vendor[]> {
  try {
    await connectDB();
    const vendors = await VendorModel.find({ city: cityName, category: catSlug })
      .sort({ isFeatured: -1, rating: -1 })
      .lean();
    return JSON.parse(JSON.stringify(vendors)) as Vendor[];
  } catch {
    return [];
  }
}

export default async function CityCategoryPage({
  params,
}: {
  params: Promise<{ city: string; category: string }>;
}) {
  const { city: citySlug, category: catSlug } = await params;
  const city = CITIES[citySlug];
  const cat = CATEGORIES[catSlug];
  if (!city || !cat) notFound();

  const vendors = await getVendors(city.name, catSlug);
  const url = `${BASE_URL}/cities/${citySlug}/${catSlug}`;
  const faqs = PATNA_FAQS[catSlug] && citySlug === 'patna'
    ? PATNA_FAQS[catSlug]
    : defaultFaqs(cat, city);

  const otherCategories = Object.entries(CATEGORIES).filter(([slug]) => slug !== catSlug);

  // JSON-LD
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: `${city.name} Wedding Vendors`, item: `${BASE_URL}/cities/${citySlug}` },
      { '@type': 'ListItem', position: 3, name: cat.plural, item: url },
    ],
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  const localBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: `ShaadiShopping — ${cat.plural} in ${city.name}`,
    description: `Verified ${cat.plural} in ${city.name}, ${city.state}. Compare packages, read reviews & get free quotes.`,
    url,
    areaServed: {
      '@type': 'City',
      name: city.name,
      containedInPlace: { '@type': 'State', name: city.state, containedInPlace: { '@type': 'Country', name: 'India' } },
    },
    address: { '@type': 'PostalAddress', addressLocality: city.name, addressRegion: city.state, addressCountry: 'IN' },
    telephone: '+91-76460-28228',
    '@id': url,
  };

  const itemListJsonLd = vendors.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `${cat.plural} in ${city.name}`,
        description: `Top verified ${cat.plural} in ${city.name}, ${city.state}`,
        numberOfItems: vendors.length,
        itemListElement: vendors.slice(0, 20).map((v, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'LocalBusiness',
            name: v.name,
            url: `${BASE_URL}/vendors/${v.id}`,
            image: v.image,
            address: { '@type': 'PostalAddress', addressLocality: city.name, addressCountry: 'IN' },
            ...(v.reviewCount > 0 && {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: v.rating,
                reviewCount: v.reviewCount,
                bestRating: 5,
              },
            }),
          },
        })),
      }
    : null;

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd} />
      <JsonLd data={localBusinessJsonLd} />
      {itemListJsonLd && <JsonLd data={itemListJsonLd} />}

      <div className="min-h-screen bg-[#FFFAF5]">

        {/* Hero */}
        <section className="bg-gradient-to-br from-[#1C0A12] via-[#2D0B1F] to-[#1C0A12] pt-20 pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center gap-2 text-white/50 text-xs mb-6">
              <Link href="/" className="hover:text-white/80 transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <Link href={`/cities/${citySlug}`} className="hover:text-white/80 transition-colors">
                {city.name} Weddings
              </Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-white/70">{cat.plural}</span>
            </nav>

            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-medium">{city.name}, {city.state}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3"
              style={{ fontFamily: 'Playfair Display, serif' }}>
              {cat.plural} in {city.name}
            </h1>
            <p className="text-white/60 text-base max-w-2xl mb-6">
              {vendors.length > 0
                ? `${vendors.length} verified ${cat.plural.toLowerCase()} in ${city.name}, ${city.state} — compare packages, read reviews & get free quotes`
                : `Find and compare verified ${cat.plural.toLowerCase()} in ${city.name}, ${city.state}`}
            </p>

            <div className="flex flex-wrap gap-3">
              <a
                href="https://wa.me/917646028228?text=Hi%21+I%27m+looking+for+wedding+vendors+in+${encodeURIComponent(city.name)}+on+ShaadiShopping"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white"
                style={{ background: '#25D366' }}
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp for Free Help
              </a>
              <a
                href="tel:+917646028228"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors"
              >
                <Phone className="w-4 h-4" /> Call ShaadiShopping
              </a>
            </div>
          </div>
        </section>

        {/* Vendor Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {vendors.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-600 text-lg mb-2">No vendors listed yet in {city.name}</p>
              <p className="text-gray-400 text-sm mb-6">We are onboarding vendors regularly. Contact us to be listed or for recommendations.</p>
              <a
                href="https://wa.me/917646028228"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-semibold"
                style={{ background: '#25D366' }}
              >
                <MessageCircle className="w-4 h-4" /> Ask on WhatsApp
              </a>
            </div>
          ) : (
            <>
              <p className="text-gray-500 text-sm mb-6">
                Showing {vendors.length} verified {cat.plural.toLowerCase()} in {city.name}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {vendors.map((vendor) => (
                  <VendorCard key={vendor.id} vendor={vendor} />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Editorial content */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="rounded-2xl p-8 border border-amber-100" style={{ background: 'rgba(197,164,109,0.05)' }}>
            <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif', color: '#1C0A12' }}>
              {cat.plural} in {city.name} — Complete Guide
            </h2>
            <p className="text-gray-600 leading-relaxed text-base">
              {editorialText(cat, city)}
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link
                href={`/cities/${citySlug}`}
                className="text-sm font-medium text-amber-700 hover:text-amber-800 underline underline-offset-2"
              >
                All vendors in {city.name} →
              </Link>
              <Link
                href={`/categories/${catSlug}`}
                className="text-sm font-medium text-amber-700 hover:text-amber-800 underline underline-offset-2"
              >
                {cat.plural} across India →
              </Link>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h2 className="text-2xl font-bold mb-8" style={{ fontFamily: 'Playfair Display, serif', color: '#1C0A12' }}>
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map(({ q, a }, i) => (
              <details
                key={i}
                className="group rounded-xl border border-gray-200 bg-white overflow-hidden"
              >
                <summary className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer font-semibold text-gray-800 hover:bg-amber-50 transition-colors list-none">
                  {q}
                  <ChevronRight className="w-4 h-4 text-amber-500 flex-shrink-0 transition-transform group-open:rotate-90" />
                </summary>
                <div className="px-6 pb-5 pt-1 text-gray-600 text-sm leading-relaxed border-t border-gray-100">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Other categories in same city */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 border-t border-gray-100">
          <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'Playfair Display, serif', color: '#1C0A12' }}>
            Other Wedding Services in {city.name}
          </h2>
          <div className="flex flex-wrap gap-2">
            {otherCategories.map(([slug, info]) => (
              <Link
                key={slug}
                href={`/cities/${citySlug}/${slug}`}
                className="px-4 py-2 rounded-full text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:border-amber-400 hover:text-amber-700 transition-colors"
              >
                {info.plural}
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-amber-500 to-rose-500 py-12">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
              Need help choosing the right {cat.name.toLowerCase()}?
            </h2>
            <p className="text-white/80 mb-6">
              Our wedding experts in {city.name} will shortlist the best options for your date and budget — for free.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="https://wa.me/917646028228?text=Hi%21+I+need+help+finding+a+wedding+vendor+in+${encodeURIComponent(city.name)}"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-sm"
                style={{ background: '#25D366', color: '#fff' }}
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp Our Team
              </a>
              <Link
                href="/plan"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-sm bg-white text-rose-600 hover:bg-rose-50 transition-colors"
              >
                Start Planning Wizard
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
