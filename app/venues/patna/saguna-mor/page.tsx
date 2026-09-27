import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { vendorRepository } from '@/repositories/vendor.repository';
import { toLocalityVenues } from '@/lib/venues/localityVendors';
import { LocalityVenuesPage } from '@/components/venues/LocalityVenuesPage';

const AREA_LABEL = 'Saguna Mor';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';
const PAGE_URL = `${BASE_URL}/venues/patna/saguna-mor`;
const WHATSAPP_MESSAGE = 'Hi, I am looking for a wedding venue in Saguna Mor, Patna. Please help.';

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
  { name: 'Danapur', href: '/venues/patna/danapur', desc: "Just up Danapur Khagaul Road — Patna's most active wedding corridor." },
  { name: 'All Patna Venues', href: '/venues/patna', desc: 'Compare every verified venue we list across Patna.' },
  { name: 'Bailey Road', href: '/venues/patna/bailey-road', desc: "Patna's premier shopping corridor for wedding essentials." },
];

const CONTENT = (
  <>
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
  </>
);

const EMPTY_NOTE =
  "We're continuously onboarding verified venues in Saguna Mor. Meanwhile, our Wedding Expert can recommend nearby verified venues that match your budget.";

export default async function SagunaMorVenuesPage() {
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
        heroTitle="Banquet Halls in Saguna Mor, Patna"
        heroTagline="An emerging wedding zone along Danapur Khagaul Road — newer venues, competitive pricing, verified by our Patna team."
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
