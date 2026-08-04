import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { LocalityGuidePage } from '@/components/venues/LocalityGuidePage';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';
const PAGE_URL = `${BASE_URL}/venues/patna/kankarbagh`;

export const metadata: Metadata = {
  title: 'Wedding Venues Near Kankarbagh, Patna — Area Guide | ShaadiShopping',
  description:
    'Planning a wedding near Kankarbagh, Patna? Get honest budget, capacity, and parking guidance, plus verified wedding venues elsewhere in Patna. Free consultation with a ShaadiShopping Wedding Expert.',
  keywords: [
    'wedding venue kankarbagh patna',
    'banquet hall kankarbagh',
    'kankarbagh patna wedding',
    'marriage hall near kankarbagh',
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'Wedding Venues Near Kankarbagh, Patna — Area Guide',
    description: 'Honest budget, capacity, and parking guidance for weddings near Kankarbagh, Patna — plus verified venues elsewhere in the city.',
    url: PAGE_URL,
    type: 'website',
    locale: 'en_IN',
    siteName: 'ShaadiShopping',
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    q: 'Is there a verified wedding venue in Kankarbagh?',
    a: 'Not yet — we\'re continuously onboarding verified venues in Kankarbagh. Meanwhile, our Wedding Expert can recommend nearby verified venues that match your budget.',
  },
  {
    q: 'What is a typical wedding budget in Patna?',
    a: 'Across Patna, banquet halls typically charge ₹999–₹1,600 per plate all-inclusive, and total wedding budgets commonly range from ₹5 lakh to ₹50 lakh depending on guest count, venue, and services.',
  },
  {
    q: 'Is parking difficult for weddings in Kankarbagh?',
    a: 'Kankarbagh is one of Patna\'s largest and most densely populated residential localities, so street parking around smaller local venues can be limited. Always confirm dedicated on-site parking before booking any function space.',
  },
  {
    q: 'Where can I shop for wedding essentials near Kankarbagh?',
    a: 'Kankarbagh has its own local markets for everyday shopping, but for wedding-specific essentials like lehengas, jewellery, and invitation cards, most families travel to Boring Road or Bailey Road — Patna\'s two established wedding-shopping corridors.',
  },
];

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'Venues', item: `${BASE_URL}/venues/patna` },
    { '@type': 'ListItem', position: 3, name: 'Patna', item: `${BASE_URL}/venues/patna` },
    { '@type': 'ListItem', position: 4, name: 'Kankarbagh', item: PAGE_URL },
  ],
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
};

export default function KankarbaghVenuesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />
      <LocalityGuidePage
        localityName="Kankarbagh"
        breadcrumbLabel="Kankarbagh"
        tagline="One of Patna's largest residential localities — an honest guide to planning a wedding near Kankarbagh."
        whatsappMessage="Hi, I am planning a wedding near Kankarbagh, Patna. Please recommend verified venues."
        honestNote="We're continuously onboarding verified venues in Kankarbagh. Meanwhile, our Wedding Expert can recommend nearby verified venues that match your budget."
        nearbyAreas={[
          { name: 'All Patna Venues', href: '/venues/patna', desc: 'Compare every verified venue we list across Patna.' },
          { name: 'Danapur', href: '/venues/patna/danapur', desc: 'Large-capacity halls built for big Bihari weddings.' },
          { name: 'Saguna Mor', href: '/venues/patna/saguna-mor', desc: 'Newer venues with in-house DJ and rooftop options.' },
        ]}
        faqs={FAQS}
        content={
          <>
            <p>
              Kankarbagh is one of Patna&apos;s largest and most established residential localities — a densely
              populated, well-connected part of the city with a long history of community halls and function spaces
              used for local celebrations. Its central location relative to Patna Junction and the rest of the city
              makes it a convenient reference point for many families when they start planning a wedding.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Average wedding budgets.</strong> We don&apos;t yet have a verified
              venue in Kankarbagh, so we won&apos;t quote Kankarbagh-specific pricing here. Across Patna more broadly,
              banquet halls typically charge ₹999–₹1,600 per plate all-inclusive, and total wedding budgets commonly
              range from ₹5 lakh to ₹50 lakh depending on guest count and the scale of décor and entertainment.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Best guest capacities.</strong> As a general rule across Patna,
              intimate weddings under 250 guests suit smaller, modern venues well, while larger 400–600+ guest
              celebrations are better served by the scale of halls found in corridors like Danapur or Saguna Mor.
              Whichever venue you consider, always confirm its seated dinner capacity specifically — it is usually
              lower than the advertised maximum.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Parking and accessibility.</strong> Kankarbagh is one of Patna&apos;s
              most densely populated residential areas, and smaller local function spaces here often have limited
              dedicated parking. If you&apos;re considering a venue in or near Kankarbagh, ask specifically about
              on-site parking capacity rather than relying on street parking for your guests.
            </p>
            <p>
              <strong className="text-[#2A1F1B]">Nearby wedding shopping.</strong> Kankarbagh has its own local markets
              for everyday shopping needs, but for wedding-specific essentials — bridal wear, jewellery, invitation
              cards — most families travel to Boring Road or Bailey Road, Patna&apos;s two established
              wedding-shopping corridors.
            </p>
          </>
        }
      />
    </>
  );
}
