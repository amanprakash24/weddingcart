import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { vendorRepository } from '@/repositories/vendor.repository';
import { toLocalityVenues } from '@/lib/venues/localityVendors';
import { LocalityVenuesPage } from '@/components/venues/LocalityVenuesPage';

const AREA_LABEL = 'Danapur';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';
const PAGE_URL = `${BASE_URL}/venues/patna/danapur`;
const WHATSAPP_MESSAGE = 'Hi, I am looking for a wedding venue in Danapur, Patna. Please help.';

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

// Built from the first real venue found for this area, not hardcoded — only rendered when at least one
// exists (see the component below). No LocalBusiness claim is ever made about a venue this page can't
// actually verify.
function buildLocalBusinessSchema(venue: { name: string; image: string; href: string; rating: number; reviewCount: number }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: venue.name,
    image: venue.image,
    address: { '@type': 'PostalAddress', addressLocality: `${AREA_LABEL}, Patna`, addressRegion: 'Bihar', addressCountry: 'IN' },
    aggregateRating: { '@type': 'AggregateRating', ratingValue: venue.rating, reviewCount: venue.reviewCount },
    url: `${BASE_URL}${venue.href}`,
  };
}

const NEARBY_AREAS = [
  { name: 'Saguna Mor', href: '/venues/patna/saguna-mor', desc: 'Just down Danapur Khagaul Road — newer venues, in-house DJ options.' },
  { name: 'All Patna Venues', href: '/venues/patna', desc: 'Compare every verified venue we list across Patna.' },
  { name: 'Boring Road', href: '/venues/patna/boring-road', desc: "Patna's premier shopping corridor, ~20–30 min from Danapur." },
];

const CONTENT = (
  <>
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
      you book: a hall&apos;s advertised &quot;capacity&quot; is often a standing or event-floor figure, not the number of
      guests it can comfortably seat for a sit-down dinner. Always ask a venue for its seated dinner capacity
      specifically — it&apos;s usually meaningfully lower than the headline number.
    </p>
    <p>
      <strong className="text-[#2A1F1B]">Parking and accessibility.</strong> Because Danapur&apos;s roads were
      built wider than much of central Patna, vehicle access and parking tend to be less chaotic here than at
      venues tucked into older, narrower neighbourhoods. That said, &quot;ample parking&quot; is a claim every venue makes —
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
  </>
);

const EMPTY_NOTE =
  "We're continuously onboarding verified venues in Danapur. Meanwhile, our Wedding Expert can recommend nearby verified venues that match your budget.";

export default async function DanapurVenuesPage() {
  const { data: vendors } = await vendorRepository.findMany({
    where: { city: 'Patna', area: AREA_LABEL, status: 'PUBLISHED', category: { slug: 'venue' } },
  });
  const venues = toLocalityVenues(
    vendors.map((v) => ({ name: v.name, slug: v.slug, rating: v.rating, guestCapacity: v.guestCapacity, venueType: v.venueType, priceMin: v.priceMin, priceMax: v.priceMax, features: v.features, image: v.image })),
    AREA_LABEL
  );

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />
      {venues[0] && <JsonLd data={buildLocalBusinessSchema({ ...venues[0], reviewCount: vendors[0].reviewCount })} />}

      <LocalityVenuesPage
        breadcrumbLabel={AREA_LABEL}
        heroTitle="Banquet Halls in Danapur, Patna"
        heroTagline="Patna's most active wedding corridor — large-capacity halls built for big baraats, verified by our Patna team."
        content={CONTENT}
        venues={venues}
        emptyNote={EMPTY_NOTE}
        nearbyAreas={NEARBY_AREAS}
        faqs={FAQS}
        whatsappMessage={WHATSAPP_MESSAGE}
      />
    </>
  );
}
