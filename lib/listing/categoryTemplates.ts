// One master design per category (founder-approved, 19 Nov 2026). Every non-venue listing renders through
// components/listing/VendorListingPage.tsx; this file decides, per category, its words and which of the shared
// sections comes first. Listings in the same category always look the same. A category not named here uses OTHER.

export type ListingSection = 'gallery' | 'packages' | 'features';

export interface CategoryTemplate {
  /** Who they are, singular: "Wedding photographer". */
  label: string;
  /** Plural for breadcrumbs and "more like this": "Photographers". */
  plural: string;
  /** The order of the three category sections (the rest of the page is shared). */
  order: ListingSection[];
  galleryKicker: string;
  galleryTitle: string;
  packagesKicker: string;
  packagesTitle: string;
  featuresTitle: string;
  /** Shown after a package price when the vendor prices that way, e.g. "/ plate". Empty = none. */
  priceUnit: string;
}

const base = {
  galleryKicker: 'Portfolio',
  galleryTitle: 'Their work',
  packagesKicker: 'Packages and prices',
  packagesTitle: 'Packages',
  featuresTitle: 'What you get',
  priceUnit: '',
};

export const CATEGORY_TEMPLATES: Record<string, CategoryTemplate> = {
  'photo-video': { ...base, label: 'Wedding photographer', plural: 'Photographers', order: ['gallery', 'packages', 'features'], galleryTitle: 'Their photos and films' },
  catering: { ...base, label: 'Wedding caterer', plural: 'Caterers', order: ['packages', 'features', 'gallery'], packagesKicker: 'Menus and prices', packagesTitle: 'Menus', priceUnit: '/ plate', galleryKicker: 'Gallery', galleryTitle: 'Their food and set-ups' },
  decorator: { ...base, label: 'Wedding decorator', plural: 'Decorators', order: ['gallery', 'packages', 'features'], galleryKicker: 'Looks', galleryTitle: 'Set-ups they have done', packagesTitle: 'Set-ups and prices' },
  makeup: { ...base, label: 'Bridal makeup artist', plural: 'Makeup artists', order: ['gallery', 'packages', 'features'], galleryKicker: 'Looks', galleryTitle: 'Bridal and party looks' },
  mehndi: { ...base, label: 'Mehndi artist', plural: 'Mehndi artists', order: ['gallery', 'packages', 'features'], galleryKicker: 'Designs', galleryTitle: 'Their mehndi designs' },
  dj: { ...base, label: 'Wedding DJ', plural: 'DJs', order: ['gallery', 'features', 'packages'], galleryKicker: 'Sets', galleryTitle: 'Their sets and stages', featuresTitle: 'Sound, lights and more' },
  band: { ...base, label: 'Wedding band', plural: 'Bands', order: ['gallery', 'features', 'packages'], galleryKicker: 'Performances', galleryTitle: 'Their baraat and stage', featuresTitle: 'What they bring' },
};

export const OTHER_TEMPLATE: CategoryTemplate = { ...base, label: 'Wedding service', plural: 'Wedding services', order: ['gallery', 'packages', 'features'], galleryKicker: 'Gallery', galleryTitle: 'Their work' };

const LABELS: Record<string, [string, string]> = {
  planning: ['Wedding planner', 'Wedding planners'],
  invitations: ['Wedding invitations', 'Invitations'],
  transport: ['Wedding transport', 'Transport'],
  security: ['Security guards and bouncers', 'Security'],
  sfx: ['SFX effects', 'SFX effects'],
  gifts: ['Wedding gifts', 'Gifts'],
  'bridal-lehenga': ['Bridal lehenga', 'Bridal lehenga'],
  'bridal-jewellery': ['Bridal jewellery', 'Bridal jewellery'],
  sherwani: ['Sherwani and groom wear', 'Groom wear'],
  trousseau: ['Trousseau packing', 'Trousseau packing'],
  astro: ['Astrologer', 'Astrologers'],
};

export function templateFor(category: string | null | undefined): CategoryTemplate {
  if (category && CATEGORY_TEMPLATES[category]) return CATEGORY_TEMPLATES[category];
  const named = category ? LABELS[category] : undefined;
  return named ? { ...OTHER_TEMPLATE, label: named[0], plural: named[1] } : OTHER_TEMPLATE;
}
