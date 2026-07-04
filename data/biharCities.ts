// Bihar expansion cities — ShaadiShopping is headquartered in Patna and its
// verified vendor network serves weddings across all of Bihar. These pages are
// indexed (unlike non-Bihar metros, which stay noindex until they have local
// vendors) because the business genuinely serves these cities from Patna.

export interface BiharCityInfo {
  name: string;
  state: 'Bihar';
  heroImage: string;
  /** One-line local flavour used to make each city's content unique */
  knownFor: string;
  /** Honest note about how ShaadiShopping serves this city */
  serviceNote: string;
}

const HERO_A = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=80';
const HERO_B = 'https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=1920&q=80';
const HERO_C = 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1920&q=80';

export const BIHAR_CITIES: Record<string, BiharCityInfo> = {
  muzaffarpur: {
    name: 'Muzaffarpur', state: 'Bihar', heroImage: HERO_A,
    knownFor: 'North Bihar\'s largest city and commercial hub, famous for its shahi litchi',
    serviceNote: 'Our Patna-based vendor network regularly serves weddings in Muzaffarpur — about 75 km from Patna via NH-22, an easy trip for decorators, photographers, makeup artists and caterers.',
  },
  gaya: {
    name: 'Gaya', state: 'Bihar', heroImage: HERO_B,
    knownFor: 'one of Bihar\'s largest cities and a major religious centre, home to the Vishnupad Temple and nearby Bodh Gaya',
    serviceNote: 'ShaadiShopping coordinates weddings in Gaya through our verified Patna vendor network — roughly 100 km away, with vendors experienced in traditional ceremonies.',
  },
  bhagalpur: {
    name: 'Bhagalpur', state: 'Bihar', heroImage: HERO_C,
    knownFor: 'the Silk City of Bihar, famous for Bhagalpuri silk and Tussar sarees prized in bridal trousseaus',
    serviceNote: 'ShaadiShopping plans weddings in Bhagalpur with vendors from our Bihar network. Bhagalpuri silk sarees are a bridal favourite — ask our experts about trousseau sourcing.',
  },
  darbhanga: {
    name: 'Darbhanga', state: 'Bihar', heroImage: HERO_A,
    knownFor: 'the cultural heart of the Mithila region, renowned for Madhubani art and Maithil wedding traditions',
    serviceNote: 'Our vendor network serves Darbhanga and the wider Mithila region — including decorators familiar with Madhubani-themed wedding décor and Maithil rituals.',
  },
  purnia: {
    name: 'Purnia', state: 'Bihar', heroImage: HERO_B,
    knownFor: 'the gateway to the Seemanchal region of north-east Bihar',
    serviceNote: 'ShaadiShopping coordinates weddings in Purnia and the Seemanchal region through our verified Bihar vendor network, with full planning support by phone and WhatsApp.',
  },
  arrah: {
    name: 'Arrah', state: 'Bihar', heroImage: HERO_C,
    knownFor: 'the headquarters of Bhojpur district, in the heart of the Bhojpuri cultural belt',
    serviceNote: 'Just ~55 km from Patna, Arrah is comfortably served by our full Patna vendor network — venues, baraat bands, DJs, caterers and decorators all travel here regularly.',
  },
  begusarai: {
    name: 'Begusarai', state: 'Bihar', heroImage: HERO_A,
    knownFor: 'Bihar\'s industrial capital on the northern bank of the Ganga',
    serviceNote: 'ShaadiShopping plans weddings in Begusarai with verified vendors from our Patna network, all of whom regularly work events across central Bihar.',
  },
  chhapra: {
    name: 'Chhapra', state: 'Bihar', heroImage: HERO_B,
    knownFor: 'the headquarters of Saran district, with deep Bhojpuri wedding traditions',
    serviceNote: 'Around 70 km from Patna, Chhapra weddings are fully served by our Patna vendor network — from baraat bands to complete venue décor.',
  },
  hajipur: {
    name: 'Hajipur', state: 'Bihar', heroImage: HERO_C,
    knownFor: 'Patna\'s twin city across the Ganga, connected by the Mahatma Gandhi Setu',
    serviceNote: 'Hajipur is minutes from Patna across the Gandhi Setu — every vendor in our Patna network serves Hajipur at no extra travel cost.',
  },
  'bihar-sharif': {
    name: 'Bihar Sharif', state: 'Bihar', heroImage: HERO_A,
    knownFor: 'the headquarters of Nalanda district, near the ancient Nalanda University ruins',
    serviceNote: 'About 70 km from Patna, Bihar Sharif is well within reach of our full vendor network. Nalanda\'s heritage sites also make stunning pre-wedding shoot backdrops.',
  },
  motihari: {
    name: 'Motihari', state: 'Bihar', heroImage: HERO_B,
    knownFor: 'the headquarters of East Champaran, the birthplace of Gandhi\'s Champaran Satyagraha',
    serviceNote: 'ShaadiShopping coordinates weddings in Motihari and the Champaran region through our verified Bihar vendor network, with complete remote planning support.',
  },
  samastipur: {
    name: 'Samastipur', state: 'Bihar', heroImage: HERO_C,
    knownFor: 'a major railway junction and agricultural hub of north Bihar',
    serviceNote: 'Our Patna vendor network serves Samastipur weddings — around 100 km away — with decorators, caterers, photographers and bands experienced in north Bihar events.',
  },
};

export const BIHAR_CITY_SLUGS = Object.keys(BIHAR_CITIES);
