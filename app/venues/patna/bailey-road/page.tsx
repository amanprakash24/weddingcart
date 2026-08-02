import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { LocalityGuidePage } from '@/components/venues/LocalityGuidePage';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';
const PAGE_URL = `${BASE_URL}/venues/patna/bailey-road`;

export const metadata: Metadata = {
  title: 'Wedding Venues Near Bailey Road, Patna — Area Guide | ShaadiShopping',
  description:
    'Planning a wedding near Bailey Road, Patna? Get honest budget, capacity, and parking guidance, plus verified wedding venues elsewhere in Patna. Free consultation with a ShaadiShopping Wedding Expert.',
  keywords: [
    'wedding venue bailey road patna',
    'banquet hall bailey road',
    'bailey road patna wedding',
    'marriage hall near bailey road',
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'Wedding Venues Near Bailey Road, Patna — Area Guide',
    description: 'Honest budget, capacity, and parking guidance for weddings near Bailey Road, Patna — plus verified venues elsewhere in the city.',
    url: PAGE_URL,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    q: 'Is there a verified wedding venue on Bailey Road?',
    a: 'Not yet — we\'re continuously onboarding verified venues on Bailey Road. In the meantime, our Wedding Expert can recommend nearby verified venues in Danapur, Saguna Mor, or elsewhere in Patna that match your budget and guest count.',
  },
  {
    q: 'What is a typical wedding budget in Patna?',
    a: 'Across Patna, banquet halls typically charge ₹999–₹1,600 per plate all-inclusive, and total wedding budgets commonly range from ₹5 lakh to ₹50 lakh depending on guest count, venue, and services.',
  },
  {
    q: 'Is parking difficult near Bailey Road?',
    a: 'Bailey Road is one of Patna\'s busiest commercial corridors, so street parking near it can be congested, especially during peak shopping hours. Any venue near this stretch should be asked for its dedicated on-site parking count.',
  },
  {
    q: 'Where can I shop for wedding essentials near Bailey Road?',
    a: 'Bailey Road is itself one of Patna\'s two best-known wedding-shopping corridors (alongside Boring Road) — a good stop for lehengas, jewellery, and wedding invitations regardless of which venue you ultimately book.',
  },
];

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Venues', item: `${BASE_URL}/venues/patna` },
    { '@type': 'ListItem', position: 3, name: 'Patna', item: `${BASE_URL}/venues/patna` },
    { '@type': 'ListItem', position: 4, name: 'Bailey Road', item: PAGE_URL },
  ],
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
};

export default function BaileyRoadVenuesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />
      <LocalityGuidePage
        localityName="Bailey Road"
        breadcrumbLabel="Bailey Road"
        tagline="Patna's premier commercial corridor — an honest guide to planning a wedding near Bailey Road."
        whatsappMessage="Hi, I am planning a wedding near Bailey Road, Patna. Please recommend verified venues."
        honestNote="We're continuously onboarding verified venues on Bailey Road. Meanwhile, our Wedding Expert can recommend nearby verified venues that match your budget."
        nearbyAreas={[
          { name: 'All Patna Venues', href: '/venues/patna', desc: 'Compare every verified venue we list across Patna.' },
          { name: 'Danapur', href: '/venues/patna/danapur', desc: 'Large-capacity halls, roughly 20–30 minutes from Bailey Road.' },
          { name: 'Saguna Mor', href: '/venues/patna/saguna-mor', desc: 'Newer venues with in-house DJ and rooftop options.' },
        ]}
        faqs={FAQS}
        content={
          <>
            <p>
              Bailey Road is one of Patna&apos;s most well-known and heavily used roads — a major commercial and
              residential artery that runs through the heart of the city, historically significant for leading toward
              the Chief Minister&apos;s residence and Raj Bhavan area, and today lined with malls, showrooms, restaurants,
              and offices. Its central location and strong connectivity make it a natural reference point for families
              across Patna when planning a wedding, even when the function itself ends up hosted elsewhere in the city.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Average wedding budgets.</strong> We don&apos;t yet have a verified
              venue directly on Bailey Road, so we won&apos;t quote Bailey-Road-specific pricing here. Across Patna more
              broadly, banquet halls typically charge ₹999–₹1,600 per plate all-inclusive, and total wedding budgets
              commonly range from ₹5 lakh to ₹50 lakh depending on guest count and the scale of décor and entertainment.
              Central, high-footfall locations in a city can sometimes carry a premium over suburban venues — worth
              keeping in mind while comparing quotes.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Best guest capacities.</strong> As a general rule across Patna, intimate
              weddings under 250 guests are well served by smaller, modern venues, while larger 400–600+ guest
              celebrations need the scale of halls found in corridors like Danapur or Saguna Mor. Always confirm a
              venue&apos;s seated dinner capacity specifically, since it is usually lower than the advertised maximum.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Parking and accessibility.</strong> Bailey Road is one of Patna&apos;s
              busiest commercial stretches, which means traffic and street parking can be genuinely congested,
              especially in the evenings and during peak shopping hours. If you&apos;re considering a venue anywhere
              near this corridor, ask specifically about dedicated on-site parking rather than relying on the road
              itself for guest vehicles.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Nearby wedding shopping.</strong> This is where Bailey Road genuinely
              shines — along with Boring Road, it&apos;s one of Patna&apos;s two most established wedding-shopping
              corridors, well known for bridal wear, jewellery, and invitation card shops. Many families plan a shopping
              trip here regardless of which locality they eventually choose for the venue itself.
            </p>
          </>
        }
      />
    </>
  );
}
