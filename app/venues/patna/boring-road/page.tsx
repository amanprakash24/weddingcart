import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { LocalityGuidePage } from '@/components/venues/LocalityGuidePage';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';
const PAGE_URL = `${BASE_URL}/venues/patna/boring-road`;

export const metadata: Metadata = {
  title: 'Wedding Venues Near Boring Road, Patna — Area Guide | ShaadiShopping',
  description:
    'Planning a wedding near Boring Road, Patna? Get honest budget, capacity, and parking guidance, plus the closest verified wedding venue (Ashiyana Resort, Digha). Free consultation with a ShaadiShopping Wedding Expert.',
  keywords: [
    'wedding venue boring road patna',
    'banquet hall boring road',
    'boring road patna wedding',
    'marriage hall near boring road',
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'Wedding Venues Near Boring Road, Patna — Area Guide',
    description: 'Honest budget, capacity, and parking guidance for weddings near Boring Road, Patna — plus the closest verified venue.',
    url: PAGE_URL,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    q: 'Is there a verified wedding venue on Boring Road itself?',
    a: 'No — we don\'t have a venue located directly on Boring Road. The closest verified option is Ashiyana Resort, in nearby Digha/Rukanpura (west Patna), which serves Boring Road families among others. Our Wedding Expert can also recommend other verified venues that match your budget.',
  },
  {
    q: 'What is a typical wedding budget in Patna?',
    a: 'Across Patna, banquet halls typically charge ₹999–₹1,600 per plate all-inclusive, and total wedding budgets commonly range from ₹5 lakh to ₹50 lakh depending on guest count, venue, and services. Ashiyana Resort, the nearest verified option to Boring Road, starts from ₹900/plate.',
  },
  {
    q: 'Is parking difficult near Boring Road?',
    a: 'Boring Road is one of Patna\'s busiest commercial and dining destinations, so street parking near it is often congested, especially in the evenings. Any venue near this stretch should be asked for its dedicated on-site parking count.',
  },
  {
    q: 'Where can I shop for wedding essentials near Boring Road?',
    a: 'Boring Road is itself one of Patna\'s two best-known wedding-shopping corridors (alongside Bailey Road) — a strong stop for lehengas, jewellery, and wedding invitations regardless of which venue you ultimately book.',
  },
];

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Venues', item: `${BASE_URL}/venues/patna` },
    { '@type': 'ListItem', position: 3, name: 'Patna', item: `${BASE_URL}/venues/patna` },
    { '@type': 'ListItem', position: 4, name: 'Boring Road', item: PAGE_URL },
  ],
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
};

export default function BoringRoadVenuesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />
      <LocalityGuidePage
        localityName="Boring Road"
        breadcrumbLabel="Boring Road"
        tagline="One of Patna's busiest commercial roads — an honest guide to planning a wedding near Boring Road."
        whatsappMessage="Hi, I am planning a wedding near Boring Road, Patna. Please recommend verified venues."
        honestNote="We don't have a venue located directly on Boring Road. The closest verified option is Ashiyana Resort in nearby Digha/Rukanpura, which serves Boring Road families among others — or our Wedding Expert can recommend other verified venues that match your budget."
        nearbyAreas={[
          { name: 'Ashiyana Resort', href: '/vendors/ashiyana-resort-rukanpura', desc: 'Closest verified venue — Digha/Rukanpura, serving Boring Road families. From ₹900/plate.' },
          { name: 'All Patna Venues', href: '/venues/patna', desc: 'Compare every verified venue we list across Patna.' },
          { name: 'Danapur', href: '/venues/patna/danapur', desc: 'Large-capacity halls built for big Bihari weddings.' },
        ]}
        faqs={FAQS}
        content={
          <>
            <p>
              Boring Road is one of Patna&apos;s best-known commercial roads — a central, heavily trafficked corridor
              lined with showrooms, restaurants, and shopping destinations that draws visitors from across the city.
              Its name and reputation make it a natural landmark for families in west and central Patna when they start
              thinking about where to host a wedding, even though the road itself is primarily commercial rather than a
              venue destination.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Average wedding budgets.</strong> We don&apos;t have a venue located
              directly on Boring Road, so we won&apos;t quote road-specific pricing here. Across Patna more broadly,
              banquet halls typically charge ₹999–₹1,600 per plate all-inclusive, and total wedding budgets commonly
              range from ₹5 lakh to ₹50 lakh depending on guest count and the scale of décor and entertainment. Ashiyana
              Resort, the closest verified venue to this area, starts from ₹900/plate.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Best guest capacities.</strong> As a general rule across Patna,
              intimate weddings under 250 guests suit smaller, modern venues well, while larger celebrations of 400–600+
              guests need the scale of halls found in corridors like Danapur, Saguna Mor, or west Patna&apos;s
              Digha/Rukanpura belt. Always confirm a venue&apos;s seated dinner capacity specifically, since it is
              usually lower than the advertised maximum.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Parking and accessibility.</strong> Boring Road is one of Patna&apos;s
              busiest commercial and dining destinations, which means traffic and street parking near it can be
              genuinely congested, particularly in the evenings. If you&apos;re considering a venue anywhere near this
              corridor, ask specifically about dedicated on-site parking rather than relying on the road itself for
              guest vehicles.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Nearby wedding shopping.</strong> This is where Boring Road genuinely
              shines — along with Bailey Road, it&apos;s one of Patna&apos;s two most established wedding-shopping
              corridors, well known for bridal wear, jewellery, and invitation card shops. Many families plan a shopping
              trip here regardless of which locality they eventually choose for the venue itself.
            </p>
          </>
        }
      />
    </>
  );
}
