import { Suspense } from 'react';
import type { Metadata } from 'next';
import CategoryPageClient from '@/components/CategoryPageClient';
import { JsonLd } from '@/components/JsonLd';
import { connectDB } from '@/lib/mongodb';
import CategoryModel from '@/lib/models/Category';
import VendorModel from '@/lib/models/Vendor';
import type { Vendor } from '@/types';

export const revalidate = 3600; // ISR: rebuild every hour

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com';

const SLUG_TO_NAME: Record<string, string> = {
  venue: 'Venues', makeup: 'Makeup Artists', mehndi: 'Mehndi Artists',
  decorator: 'Decorators', band: 'Band & Music', dj: 'DJ Services',
  catering: 'Catering Services', 'photo-video': 'Photographers & Videographers',
  accommodation: 'Accommodation', gifts: 'Gifts & Favours', invitations: 'Invitations',
  transport: 'Transport', legal: 'Legal Services', hospitality: 'Hospitality',
  planning: 'Wedding Planners', astro: 'Astrology & Pandits', 'bridal-lehenga': 'Bridal Lehenga',
  'bridal-jewellery': 'Bridal Jewellery', sherwani: 'Sherwani & Groom Wear',
  trousseau: 'Trousseau Packing', sfx: 'SFX Effects', security: 'Security Guards & Bouncers',
};

const FAQ_MAP: Record<string, { q: string; a: string }[]> = {
  venue: [
    { q: 'How much does a wedding venue cost in India?', a: 'Wedding venues in India range from ₹1.5 lakh to ₹40 lakh per day depending on city, venue type (banquet hall, palace, farmhouse, resort), and guest count.' },
    { q: 'How early should I book a wedding venue?', a: 'Book at least 6–12 months in advance for popular venues. Peak wedding season (October–February) fills up fast — we recommend starting your search immediately after fixing your date.' },
    { q: 'What types of wedding venues are available in India?', a: 'Common options include 5-star hotel banquet halls, farmhouses and lawns, palace and heritage properties, beach venues, garden lawns, and marriage gardens.' },
    { q: 'What is typically included in a wedding venue package?', a: 'Most venue packages include basic furniture setup, parking, bridal suite, and a dedicated event coordinator. Premium venues may also include décor, catering, and on-site accommodation.' },
  ],
  makeup: [
    { q: 'How much does bridal makeup cost in India?', a: 'Professional bridal makeup costs between ₹15,000 and ₹80,000 depending on the artist\'s experience, location, and type (HD, airbrush, or traditional).' },
    { q: 'What is the difference between airbrush and HD bridal makeup?', a: 'Airbrush makeup uses a compressor to spray a fine mist of foundation for a flawless, sweat-resistant finish. HD makeup is camera-optimised with high-coverage products that photograph beautifully without flashback.' },
    { q: 'How many days before the wedding should I do a makeup trial?', a: 'Schedule a makeup trial 4–6 weeks before the wedding. This gives time to adjust the look, source any missing products, and ensure you\'re comfortable with the final style.' },
    { q: 'How far in advance should I book a bridal makeup artist?', a: 'Book your makeup artist at least 3–6 months in advance, especially for peak wedding season (October–February). Top artists get booked a year ahead.' },
  ],
  mehndi: [
    { q: 'How much does a mehndi artist charge for a wedding in India?', a: 'Bridal mehndi artists charge between ₹8,000 and ₹35,000 depending on design complexity, area of coverage (hands only or hands + feet), and location.' },
    { q: 'When should mehndi be applied before the wedding?', a: 'Apply mehndi 2–3 days before the wedding for the colour to fully develop. The henna darkens over 24–48 hours and reaches its deepest shade by day 2.' },
    { q: 'How long does bridal mehndi application take?', a: 'Full bridal mehndi (hands and feet with intricate designs) typically takes 4–8 hours. Plan your mehndi ceremony accordingly and ensure the artist has enough time.' },
    { q: 'What is the difference between Arabic and Rajasthani mehndi?', a: 'Arabic mehndi features flowing floral patterns with negative space. Rajasthani mehndi is denser with intricate motifs covering the entire hand and forearm.' },
  ],
  'photo-video': [
    { q: 'How much does a wedding photographer cost in India?', a: 'Wedding photography packages range from ₹50,000 for local photographers to ₹3 lakh+ for top-tier candid photographers. Videography is typically priced separately at ₹30,000–₹2 lakh.' },
    { q: 'What is the difference between candid and traditional wedding photography?', a: 'Candid photography captures genuine, unposed emotions throughout your day. Traditional photography involves posed portraits and formal group shots. Most couples book both styles.' },
    { q: 'How long does it take to receive edited wedding photos?', a: 'Most photographers deliver fully edited photos within 4–8 weeks. Pre-wedding or highlight reel videos may take 6–12 weeks. Confirm timelines before booking.' },
    { q: 'What should I ask a wedding photographer before booking?', a: 'Ask to see full wedding galleries (not just highlights), confirm they use backup equipment, clarify how many hours are included, and discuss rights to the photos.' },
  ],
  catering: [
    { q: 'How much does wedding catering cost per plate in India?', a: 'Wedding catering costs ₹450–₹1,200 per plate for vegetarian menus and ₹600–₹1,500 for non-vegetarian, depending on menu complexity, service style, and city.' },
    { q: 'What is the difference between buffet and plated service at weddings?', a: 'Buffet allows guests to serve themselves from multiple stations. Plated service is a structured multi-course meal served at the table. Buffet is more common at Indian weddings; plated suits smaller, formal receptions.' },
    { q: 'How far in advance should I finalise my wedding menu?', a: 'Finalise your menu 2–3 months before the wedding. Schedule a tasting 4–6 weeks prior to confirm quality and make any adjustments.' },
    { q: 'How do I estimate the amount of food needed for a wedding?', a: 'A good rule: plan for 100–110% of your guest count on food portions. Account for children, dietary restrictions, and multi-cuisine spreads. Your caterer will help with exact quantities.' },
  ],
  decorator: [
    { q: 'How much does wedding decoration cost in India?', a: 'Wedding decoration costs range from ₹50,000 for simple setups to ₹5 lakh+ for elaborate floral, themed, or LED décor. Destination weddings and multi-day events cost more.' },
    { q: 'What are the most popular wedding decoration themes in India?', a: 'Popular themes include Royal, Floral Garden, Rustic Bohemian, Minimalist White, Bollywood Glam, Rajasthani Heritage, and Pastel Elegance.' },
    { q: 'How early should I book a wedding decorator?', a: 'Book your decorator 4–6 months in advance to secure your preferred vendor and allow time for concept development, material sourcing, and mock-up setups.' },
    { q: 'Should I hire a decorator who also does florals?', a: 'Yes — hiring a single vendor for décor and florals ensures a cohesive aesthetic and simplifies coordination. Many top decorators handle both in-house.' },
  ],
  dj: [
    { q: 'How much does a wedding DJ cost in India?', a: 'Wedding DJs charge between ₹15,000 and ₹50,000 per event depending on equipment quality, lighting setup, and the DJ\'s popularity. Premium DJs with LED rigs and visualisers charge more.' },
    { q: 'What equipment does a professional wedding DJ provide?', a: 'A professional DJ brings high-quality sound systems, DJ console, LED lighting rigs, laser effects, and sometimes fog machines. Confirm what\'s included before booking.' },
    { q: 'How far in advance should I share my music playlist with the DJ?', a: 'Share your must-play and do-not-play lists at least 2 weeks before the event. Include family-specific songs for key moments like the couple\'s first entry and the first dance.' },
    { q: 'Can a DJ also handle the emcee duties at a wedding?', a: 'Many DJs also act as MC (host/anchor). Confirm this capability during your booking conversation if you want them to announce events and engage the crowd.' },
  ],
  band: [
    { q: 'How much does a wedding band cost in India?', a: 'Wedding bands and orchestras charge ₹30,000 to ₹80,000 depending on the number of musicians, instruments, and performance duration.' },
    { q: 'What is a baraat band?', a: 'A baraat band is a traditional brass or dhol ensemble that plays during the groom\'s wedding procession. They typically include trumpets, tubas, clarinets, and dhol for an energetic celebration.' },
    { q: 'Can I hire a band for the sangeet night too?', a: 'Absolutely. Many wedding bands perform at both the sangeet and baraat. Discuss your full event schedule with them to plan the right repertoire and pricing.' },
    { q: 'What is the difference between a wedding DJ and a live band?', a: 'A live band delivers a unique, energetic performance with real instruments. A DJ offers greater musical variety and flexibility. Many couples hire both — a band for the baraat and a DJ for the reception.' },
  ],
  planning: [
    { q: 'How much does a wedding planner cost in India?', a: 'Wedding planners charge ₹50,000 to ₹3 lakh+ depending on the scope of services, wedding size, and location. Full-service planners typically charge 10–15% of the total wedding budget.' },
    { q: 'What does a full-service wedding planner do?', a: 'A full-service wedding planner handles vendor selection, contract negotiations, budget management, timeline creation, vendor coordination, and complete day-of execution — so you can enjoy your wedding stress-free.' },
    { q: 'Should I hire a wedding planner or a day-of coordinator?', a: 'Hire a full-service planner if you want help from the very beginning. A day-of coordinator manages only the wedding day logistics. For stress-free planning from start to finish, a full-service planner is the better investment.' },
    { q: 'How early should I hire a wedding planner?', a: 'Hire a planner as early as possible — ideally 12–18 months before your wedding. Top planners get booked fast, especially for peak season dates.' },
  ],
  sfx: [
    { q: 'What special effects are popular at Indian weddings?', a: 'Popular wedding SFX include cold pyro (cold spark machines), confetti cannons, fog machines, laser light shows, fireworks, CO2 jets, and drone light displays. Cold pyro is the most widely used as it is safe indoors.' },
    { q: 'How much do special effects cost at a wedding in India?', a: 'Wedding SFX packages start from ₹25,000 for basic cold pyro setups to ₹2 lakh+ for full laser, drone, and fireworks shows.' },
    { q: 'Are fireworks allowed at wedding venues in India?', a: 'Fireworks require prior permission from local authorities. Outdoor venues and farmhouses generally permit them. Indoor venues typically use cold pyro or CO2 jets as a safe, spectacular alternative.' },
    { q: 'What is a cold pyro machine and is it safe?', a: 'A cold spark machine (cold pyro) creates a fountain of sparks at a safe, low temperature — no fire risk, no smoke smell. Ideal for first dances, couple entries, and stage moments.' },
  ],
  security: [
    { q: 'Why do I need security guards at my wedding?', a: 'Security guards manage crowd flow, protect gifts and valuables, control entry points, handle parking logistics, and ensure guest safety — especially important for large weddings of 300+ guests.' },
    { q: 'How much do security guards cost for a wedding in India?', a: 'Professional event security services cost ₹8,000 to ₹50,000 depending on the number of guards required, event duration, and whether armed or unarmed personnel are needed.' },
    { q: 'How many security guards do I need for my wedding?', a: 'A general guideline is 1 guard per 100 guests for basic crowd management. For 500+ guest weddings, also hire a dedicated security supervisor. High-value weddings may need additional guards for the gift area.' },
    { q: 'What does a wedding security team typically manage?', a: 'A wedding security team handles guest entry verification, parking management, gift table protection, vendor access control, and emergency response coordination throughout the event.' },
  ],
  accommodation: [
    { q: 'How do I arrange accommodation for wedding guests?', a: 'Contact nearby hotels to block rooms at group rates. ShaadiShopping helps coordinate block bookings, welcome kits, and guest shuttle services to and from your venue.' },
    { q: 'How early should I block hotel rooms for wedding guests?', a: 'Block hotel rooms at least 4–6 months in advance. For destination weddings in popular locations like Goa, Jaipur, or Udaipur, book 9–12 months ahead as rooms fill up quickly.' },
  ],
  transport: [
    { q: 'What types of wedding transport are available in India?', a: 'Options include vintage cars, luxury sedans and SUVs, decorated dulha chariots (rath), horse-drawn carriages, vintage buses for guest transfers, and helicopters for destination weddings.' },
    { q: 'How much does wedding transportation cost in India?', a: 'Wedding transport costs ₹10,000 to ₹40,000 for the bridal car depending on vehicle type and hours. Guest shuttle buses cost ₹5,000–₹15,000 per trip.' },
  ],
  gifts: [
    { q: 'What are popular wedding return gifts in India?', a: 'Popular return gifts include personalised items, premium dry fruit boxes, silver coins, scented candle sets, artisan hampers, copper bottles, and customised sweet boxes.' },
    { q: 'How much should I budget for wedding return gifts?', a: 'Budget ₹500–₹2,000 per guest for standard return gifts. For close family and VIP guests, premium hampers worth ₹3,000–₹5,000 are a thoughtful gesture.' },
  ],
  invitations: [
    { q: 'What are the latest wedding invitation trends in India?', a: 'Top trends include foil-stamped cards, boxed invitations with multiple inserts, digital animated e-invites, eco-friendly seed paper cards, and personalised video invitations.' },
    { q: 'How early should I send out wedding invitations?', a: 'Send printed invitations 4–6 weeks before the wedding. For destination weddings, send 6–8 weeks in advance. Digital save-the-dates should go out 3–6 months ahead.' },
  ],
  'bridal-lehenga': [
    { q: 'How much does a bridal lehenga cost in India?', a: 'Bridal lehengas range from ₹30,000 for designer-inspired pieces to ₹5 lakh+ for high-end couture. Rental options from ₹15,000 are popular for budget-conscious brides.' },
    { q: 'How early should I buy my bridal lehenga?', a: 'Order or shortlist your lehenga at least 4–6 months before the wedding to allow time for alterations, embroidery customisation, and multiple fitting sessions.' },
  ],
  'bridal-jewellery': [
    { q: 'What jewellery does a bride typically wear at an Indian wedding?', a: 'Bridal sets typically include a necklace (haar), maang tikka, earrings (jhumkas), bangles (chura), haath phool, nath (nose ring), and kamarbandh (waistband). Gold, kundan, polki, and temple jewellery are most popular.' },
    { q: 'How much does bridal jewellery cost in India?', a: 'Fashion jewellery sets start from ₹50,000. Real gold kundan and polki sets range from ₹5–₹20 lakh+. Diamond bridal jewellery can exceed ₹20 lakh for high-end pieces.' },
  ],
  sherwani: [
    { q: 'How much does a groom\'s sherwani cost in India?', a: 'Sherwanis range from ₹15,000 for readymade options to ₹1 lakh+ for custom-embroidered designer pieces from top couture houses.' },
    { q: 'What is the difference between a sherwani and a bandhgala?', a: 'A sherwani is a long coat (knee to ankle length) with a mandarin collar, ideal for the wedding ceremony. A bandhgala (Nehru jacket) is shorter, more structured, and often worn for receptions or sangeet.' },
  ],
  astro: [
    { q: 'What is muhurat for a wedding?', a: 'Muhurat is an auspicious date and time for the wedding ceremony calculated by a Pandit based on the couple\'s kundalis and planetary positions. A good muhurat is believed to bring prosperity and happiness to the marriage.' },
    { q: 'Is kundali matching necessary for marriage in India?', a: 'Kundali matching is a traditional Vedic compatibility check. Many families consider it essential. It evaluates 36 gunas (points) across 8 key traits. A score of 18+ is generally considered compatible.' },
  ],
  trousseau: [
    { q: 'What is trousseau packing for a wedding?', a: 'Trousseau packing involves decoratively wrapping the bride\'s outfits, jewellery, accessories, and gifts in beautiful packaging for the vidaai (farewell). It\'s a cherished tradition across North and South India.' },
    { q: 'How much does trousseau packing cost in India?', a: 'Trousseau packing services cost ₹10,000 to ₹40,000 depending on the number of items, packaging materials (silk, organza, boxes), and design complexity.' },
  ],
  legal: [
    { q: 'How do I register a marriage in India?', a: 'Visit the local Registrar or Sub-Divisional Magistrate (SDM) office with Aadhaar/PAN, birth certificates, address proof, two witness IDs, and passport-size photos. ShaadiShopping assists with all paperwork.' },
    { q: 'What documents are needed for court marriage in India?', a: 'Required documents include Aadhaar card, PAN card, birth certificate (or 10th marksheet), address proof, two passport-size photos each, and two witnesses with valid ID.' },
  ],
  hospitality: [
    { q: 'What does wedding hospitality management include?', a: 'Wedding hospitality covers guest registration desks, welcome kits, concierge services, dietary coordination, transportation scheduling, and end-to-end guest experience management throughout the event.' },
    { q: 'Why should I hire a separate hospitality team for my wedding?', a: 'A dedicated hospitality team ensures guests feel welcomed and cared for while you enjoy your celebration. They handle seating queries, dietary needs, lost items, and last-minute requests seamlessly.' },
  ],
};

interface CategoryMeta {
  name: string;
  description: string;
  image: string;
  updatedAt?: Date;
}

async function getInitialVendors(slug: string): Promise<Vendor[]> {
  try {
    const vendors = await VendorModel.find({ category: slug })
      .sort({ isFeatured: -1, rating: -1 })
      .limit(6)
      .lean();
    return JSON.parse(JSON.stringify(vendors)) as Vendor[];
  } catch {
    return [];
  }
}

async function getCategoryMeta(slug: string): Promise<CategoryMeta | null> {
  try {
    await connectDB();
    const cat = await CategoryModel.findOne({ id: slug })
      .select('name description image updatedAt')
      .lean<CategoryMeta>();
    return cat ?? null;
  } catch {
    return null;
  }
}

export function generateStaticParams() {
  return [
    'venue', 'makeup', 'mehndi', 'decorator', 'band', 'dj',
    'catering', 'photo-video', 'accommodation', 'gifts', 'invitations',
    'transport', 'legal', 'hospitality', 'planning', 'astro',
    'bridal-lehenga', 'bridal-jewellery', 'sherwani', 'trousseau', 'sfx', 'security',
  ].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCategoryMeta(slug);
  const name = cat?.name ?? SLUG_TO_NAME[slug] ?? slug;
  const url = `${BASE_URL}/categories/${slug}`;

  const title = `${name} in India — Compare & Book Top Wedding ${name} | ShaadiShopping`;
  const description =
    cat?.description ||
    `Find and book the best ${name.toLowerCase()} for your wedding in India. Compare verified vendors, browse packages, read real reviews, and get free quotes. Patna, Delhi, Mumbai & more.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      locale: 'en_IN',
      images: cat?.image ? [{ url: cat.image, width: 1200, height: 630, alt: name }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: cat?.image ? [cat.image] : [],
    },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [cat, initialVendors] = await Promise.all([
    getCategoryMeta(slug),
    getInitialVendors(slug),
  ]);
  const name = cat?.name ?? SLUG_TO_NAME[slug] ?? slug;
  const url = `${BASE_URL}/categories/${slug}`;
  const description = cat?.description ?? `Top wedding ${name.toLowerCase()} in India`;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: name, item: url },
    ],
  };

  const collectionPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${name} — ShaadiShopping`,
    description,
    url,
    ...(cat?.image && { image: cat.image }),
  };

  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${name} in India`,
    description,
    provider: {
      '@type': 'Organization',
      name: 'ShaadiShopping',
      url: BASE_URL,
    },
    areaServed: { '@type': 'Country', name: 'India' },
    url,
  };

  const faqs = FAQ_MAP[slug] ?? [];
  const faqJsonLd = faqs.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      }
    : null;

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={collectionPageJsonLd} />
      <JsonLd data={serviceJsonLd} />
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      <Suspense>
        <CategoryPageClient
          slug={slug}
          initialCoverImage={cat?.image}
          initialName={cat?.name}
          initialDescription={cat?.description}
          initialVendors={initialVendors}
          faqs={faqs}
        />
      </Suspense>
    </>
  );
}
