// The master venue page (/venues/[slug]) shows every venue the same way, built only from its saved listing.
// This turns a listing into what the page shows: one set of rules for every venue, and anything missing is hidden or
// shown as "Ask us", never blank and never made up. Pure; no database or browser code. (Founder-approved design,
// 19 Nov 2026: one category = one master design.)

export const ASK_US = 'Ask us';

export interface VenueListing {
  slug: string;
  name: string;
  city: string;
  address?: string | null;
  area?: string | null; // admin-set locality slug, e.g. "boring-road"
  venueType?: string | null; // "Resort , Banquet Hall , Lawn, Rooms"
  guestCapacity?: number | null;
  priceMin: number;
  priceMax: number;
  priceUnit?: string | null; // 'PER_PLATE' | 'PACKAGE'
  rating: number;
  reviewCount: number;
  image?: string | null;
  images?: string[] | null;
  virtualTourVideo?: string | null;
  description?: string | null;
  features?: string[] | null;
  packages?: { id: string; name: string; price: number; features?: string[] | null; isPerPlate?: boolean | null }[] | null;
  faqs?: { q: string; a: string }[] | null;
  mapEmbedUrl?: string | null;
}

export interface VenueSpaceView { name: string; kind: string; seated: string; max: string }
export interface VenuePackageView { id: string; name: string; price: string; unit: string; points: string[] }

export interface VenueView {
  slug: string;
  name: string;
  kind: string;
  place: string;
  address: string;
  onlineRating: { value: string; count: number } | null;
  facts: { label: string; value: string }[];
  photos: string[];
  video: string | null;
  about: string;
  hours: string | null;
  events: string[];
  spaces: VenueSpaceView[];
  amenities: string[];
  packages: VenuePackageView[];
  faqs: { q: string; a: string }[];
  mapEmbedUrl: string | null;
  mapsLink: string;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const titleCase = (s: string) => s.split(/[-\s]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** The locality from a free-text address: the segment right before the city name, unless it is a landmark ("Near X"). */
export function localityFromAddress(address: string | null | undefined, city: string): string | null {
  if (!address) return null;
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  const cityIdx = parts.findIndex((p) => p.toLowerCase().includes(city.toLowerCase()));
  if (cityIdx <= 0) return null;
  const candidate = parts[cityIdx - 1];
  if (/^(near|opposite|opp\.?)\b/i.test(candidate)) return null;
  return candidate;
}

export function venuePlace(v: Pick<VenueListing, 'area' | 'address' | 'city'>): string {
  const locality = v.area ? titleCase(v.area) : localityFromAddress(v.address, v.city);
  return locality ? `${locality}, ${v.city}` : v.city;
}

const HOURS = /^operating hours\s*:\s*(.+)$/i;
// "Hall Capacity: 300 Seated / 450 Max"
const CAPACITY = /^(.+?)\s+capacity\s*:\s*([\d,]+)\s*seated\s*\/\s*([\d,]+)\s*max/i;
const SPACE_WORD = /\b(hall|lawn|banquet|garden|terrace|rooftop|courtyard)\b/i;
const OUTDOOR_WORD = /\b(lawn|garden|terrace|rooftop|courtyard|outdoor)\b/i;
const ROOMS = /(\d+)\s+(?:[a-z-]+\s+){0,2}rooms?\b/i;

function spaceKind(name: string): string {
  return OUTDOOR_WORD.test(name) ? 'Outdoor' : 'Indoor';
}

/** Halls and lawns: from "X Capacity: N Seated / M Max" lines when the listing has them, else its hall/lawn features. */
export function venueSpaces(features: string[], guestCapacity: number | null | undefined): VenueSpaceView[] {
  const withCapacity = features.map((f) => CAPACITY.exec(f.trim())).filter((m): m is RegExpExecArray => m !== null);
  if (withCapacity.length > 0) {
    return withCapacity.map((m) => ({ name: titleCase(m[1]), kind: spaceKind(m[1]), seated: m[2], max: m[3] }));
  }
  const seated = guestCapacity && guestCapacity > 0 ? `Up to ${guestCapacity.toLocaleString('en-IN')}` : ASK_US;
  return features
    .filter((f) => SPACE_WORD.test(f) && !/\d/.test(f) && !/\+/.test(f))
    .slice(0, 4)
    .map((f) => ({ name: f.trim(), kind: spaceKind(f), seated, max: ASK_US }));
}

/** Guest rooms the venue offers ("5 Complimentary Rooms with Events", "10 Guest Rooms Available Onsite"); changing rooms do not count. */
export function venueRooms(features: string[]): number | null {
  for (const f of features) {
    if (/changing/i.test(f)) continue;
    const m = ROOMS.exec(f);
    if (m) return Number(m[1]);
  }
  return null;
}

const EVENTS: [RegExp, string][] = [
  [/\bweddings?\b/i, 'Weddings'],
  [/\breceptions?\b/i, 'Receptions'],
  [/\bengagements?\b/i, 'Engagements'],
  [/\bbirthdays?\b/i, 'Birthdays'],
  [/\banniversar(y|ies)\b/i, 'Anniversaries'],
  [/\bcorporate\b/i, 'Corporate events'],
  [/\bfamily functions?\b/i, 'Family functions'],
  [/\bcelebrations?\b/i, 'Celebrations'],
];

/** Events the venue says it hosts, read from its own description. */
export function venueEvents(description: string): string[] {
  return EVENTS.filter(([re]) => re.test(description)).map(([, label]) => label);
}

const PRICE_LINE = /^₹?\s*[\d,]+\s*(per plate|\/\s*plate)/i;

function isPerPlateVenue(v: VenueListing): boolean {
  if (v.priceUnit === 'PER_PLATE') return true;
  return (v.packages ?? []).some((p) => p.isPerPlate === true || (p.features ?? []).some((f) => /per plate/i.test(f)));
}

/** "From ₹900 / plate" style starting price: the cheapest package when there are packages (as on the venue cards). */
export function venueStartingPrice(v: VenueListing): string {
  const packagePrices = (v.packages ?? []).map((p) => p.price).filter((n) => Number.isFinite(n) && n > 0);
  if (isPerPlateVenue(v)) {
    const plate = packagePrices.length > 0 ? Math.min(...packagePrices) : v.priceMin > 0 ? v.priceMin : v.priceMax;
    return plate > 0 ? `${rupees(plate)} / plate` : ASK_US;
  }
  const from = packagePrices.length > 0 ? Math.min(...packagePrices) : v.priceMin;
  return from > 0 ? rupees(from) : ASK_US;
}

export function toVenueView(v: VenueListing): VenueView {
  const features = (v.features ?? []).map((f) => f.trim()).filter(Boolean);
  const hoursLine = features.map((f) => HOURS.exec(f)).find((m) => m);
  const spaces = venueSpaces(features, v.guestCapacity);
  const rooms = venueRooms(features);
  const description = (v.description ?? '').trim();
  const perPlate = isPerPlateVenue(v);

  const maxGuests = v.guestCapacity && v.guestCapacity > 0
    ? v.guestCapacity
    : Math.max(0, ...spaces.map((s) => Number(s.max.replace(/,/g, '')) || 0));
  const facts = [
    { label: 'Guests', value: maxGuests > 0 ? `Up to ${maxGuests.toLocaleString('en-IN')}` : ASK_US },
    { label: 'Starting price', value: venueStartingPrice(v) },
    ...(spaces.length > 0 ? [{ label: 'Spaces', value: spaces.length <= 2 ? spaces.map((s) => s.name).join(' + ') : `${spaces.length} spaces` }] : []),
    ...(rooms ? [{ label: 'Guest rooms', value: `${rooms} rooms` }] : []),
  ];

  const photos = [...new Set([v.image, ...(v.images ?? [])].filter((p): p is string => typeof p === 'string' && p.trim() !== ''))];

  const packages = (v.packages ?? [])
    .filter((p) => p.name?.trim())
    .map((p) => {
      const pkgPerPlate = perPlate || p.isPerPlate === true || (p.features ?? []).some((f) => /per plate/i.test(f));
      return {
        id: p.id,
        name: p.name.trim(),
        price: p.price > 0 ? rupees(p.price) : ASK_US,
        unit: p.price > 0 && pkgPerPlate ? '/ plate' : '',
        points: (p.features ?? []).map((f) => f.trim()).filter((f) => f && !PRICE_LINE.test(f)),
      };
    });

  return {
    slug: v.slug,
    name: v.name,
    kind: v.venueType?.trim() ? v.venueType.split(',').map((s) => s.trim()).filter(Boolean).join(' · ') : 'Wedding venue',
    place: venuePlace(v),
    address: v.address?.trim() || v.city,
    onlineRating: v.reviewCount > 0 && v.rating > 0 ? { value: v.rating.toFixed(1), count: v.reviewCount } : null,
    facts,
    photos,
    video: v.virtualTourVideo?.trim() || null,
    about: description,
    hours: hoursLine ? hoursLine[1].trim() : null,
    events: venueEvents(description),
    spaces,
    amenities: features.filter((f) => !HOURS.test(f) && !CAPACITY.test(f)),
    packages,
    faqs: (v.faqs ?? []).filter((f) => f.q?.trim() && f.a?.trim()),
    mapEmbedUrl: v.mapEmbedUrl?.trim() || null,
    mapsLink: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.name}, ${v.address?.trim() || v.city}`)}`,
  };
}
