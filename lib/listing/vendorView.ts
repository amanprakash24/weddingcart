// What a non-venue listing page shows, built only from the saved listing (same rules as venueView: missing → hidden
// or "Ask us", nothing invented). Pure; no database or browser code.
import { ASK_US, venuePlace } from './venueView';
import { templateFor, type CategoryTemplate } from './categoryTemplates';
import { isOwnContactLine } from './ownContact';

export { isOwnContactLine };

export interface VendorListing {
  slug: string;
  name: string;
  category: string;
  city: string;
  address?: string | null;
  area?: string | null;
  priceMin: number;
  priceMax: number;
  priceUnit?: string | null;
  rating: number;
  reviewCount: number;
  image?: string | null;
  images?: string[] | null;
  virtualTourVideo?: string | null;
  description?: string | null;
  features?: string[] | null;
  packages?: { id: string; name: string; price: number; features?: string[] | null; isPerPlate?: boolean | null }[] | null;
  faqs?: { q: string; a: string }[] | null;
}

export interface VendorView {
  slug: string;
  name: string;
  template: CategoryTemplate;
  place: string;
  onlineRating: { value: string; count: number } | null;
  facts: { label: string; value: string }[];
  photos: string[];
  video: string | null;
  about: string;
  features: string[];
  packages: { id: string; name: string; price: string; unit: string; points: string[] }[];
  faqs: { q: string; a: string }[];
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const EXPERIENCE = /^(\d+\s*(?:\+|–|-|to)?\s*\d*\s*\+?)\s*years? of experience$/i;
const PRICE_LINE = /^₹?\s*[\d,]+\s*(per plate|\/\s*plate)/i;

export function toVendorView(v: VendorListing): VendorView {
  const template = templateFor(v.category);
  const lines = (v.features ?? []).map((f) => f.trim()).filter((f) => f && !isOwnContactLine(f));
  const experienceLine = lines.map((f) => EXPERIENCE.exec(f)).find((m) => m);
  const features = lines.filter((f) => !EXPERIENCE.test(f));

  const perPlate = v.priceUnit === 'PER_PLATE' || template.priceUnit === '/ plate';
  const packagePrices = (v.packages ?? []).map((p) => p.price).filter((n) => Number.isFinite(n) && n > 0);
  const from = packagePrices.length > 0 ? Math.min(...packagePrices) : v.priceMin;
  const starting = from > 0 ? `${rupees(from)}${perPlate ? ' / plate' : ''}` : ASK_US;

  const photos = [...new Set([v.image, ...(v.images ?? [])].filter((p): p is string => typeof p === 'string' && p.trim() !== ''))];

  return {
    slug: v.slug,
    name: v.name,
    template,
    place: venuePlace(v),
    onlineRating: v.reviewCount > 0 && v.rating > 0 ? { value: v.rating.toFixed(1), count: v.reviewCount } : null,
    facts: [
      { label: 'Starting price', value: starting },
      ...(experienceLine ? [{ label: 'Experience', value: `${experienceLine[1].replace(/\s+/g, '')} years` }] : []),
      ...(photos.length > 0 ? [{ label: 'Photos', value: String(photos.length) }] : []),
    ],
    photos,
    video: v.virtualTourVideo?.trim() || null,
    about: (v.description ?? '').trim(),
    features,
    packages: (v.packages ?? []).filter((p) => p.name?.trim()).map((p) => {
      const plate = perPlate || p.isPerPlate === true || (p.features ?? []).some((f) => /per plate/i.test(f));
      return {
        id: p.id,
        name: p.name.trim(),
        price: p.price > 0 ? rupees(p.price) : ASK_US,
        unit: p.price > 0 && plate ? '/ plate' : '',
        points: (p.features ?? []).map((f) => f.trim()).filter((f) => f && !PRICE_LINE.test(f) && !isOwnContactLine(f)),
      };
    }),
    faqs: (v.faqs ?? []).filter((f) => f.q?.trim() && f.a?.trim()),
  };
}
