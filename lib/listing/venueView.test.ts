/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { toVenueView, venuePlace, venueSpaces, venueRooms, venueEvents, venueStartingPrice, ASK_US, type VenueListing } from './venueView';

// Shaped like the live listings on 19 Nov 2026.
const cozy: VenueListing = {
  slug: 'touch-of-cozy-patna', name: 'Touch of Cozy', city: 'Patna',
  address: 'Rajeev Nagar Road No 23, Near Atal Path Branch Road, Mica Colony, Patna-12',
  priceMin: 100000, priceMax: 600000, priceUnit: 'PACKAGE', rating: 5, reviewCount: 1,
  image: 'a.jpg', images: ['a.jpg', 'b.jpg'],
  description: 'We host weddings, engagements, birthdays, anniversaries, corporate events, and family functions.',
  features: ['AC Banquet Hall', '5 Complimentary Rooms with Events', 'In-House Catering', 'Operating Hours: 11 AM – 12 AM'],
  packages: [
    { id: 'p1', name: 'Veg Standard Package', price: 900, isPerPlate: false, features: ['₹900 per plate (all-inclusive)', 'Pure vegetarian menu'] },
    { id: 'p2', name: 'Non-Veg Platinum Package', price: 1250, isPerPlate: false, features: ['₹1250 per plate (all-inclusive)', 'Valet parking'] },
  ],
  faqs: [{ q: 'Q?', a: 'A.' }, { q: '', a: 'no question' }],
};

const ashiyana: VenueListing = {
  slug: 'ashiyana-resort-rukanpura', name: 'Ashiyana Resort', city: 'Patna',
  address: 'Opp. Kali Mandir, Ashiana - Digha Rd, near Don Bosco School, Rukanpura, Patna, Bihar 800011',
  venueType: 'Resort , Banquet Hall , Lawn, Rooms', guestCapacity: 1000,
  priceMin: 250000, priceMax: 450000, priceUnit: 'PER_PLATE', rating: 5, reviewCount: 1,
  image: 'x.jpg', images: ['x.jpg', 'y.jpg', 'x.jpg'],
  description: 'Offering both indoor and outdoor settings for weddings and celebrations.',
  features: ['Indoor Banquet Hall + Outdoor Lawn', 'Hall Capacity: 300 Seated / 450 Max', 'Lawn Capacity: 400 Seated / 600 Max', '4 AC Changing Rooms', '10 Guest Rooms Available Onsite'],
  packages: [
    { id: 'v', name: 'Vegetarian Package', price: 900, isPerPlate: false, features: [] },
    { id: 'n', name: 'Non-Vegetarian Package', price: 1000, isPerPlate: false, features: [] },
  ],
};

describe('toVenueView — Touch of Cozy', () => {
  const v = toVenueView(cozy);
  test('place from the address, hours taken out of the facilities', () => {
    expect(v.place).toBe('Mica Colony, Patna');
    expect(v.hours).toBe('11 AM – 12 AM');
    expect(v.amenities).not.toContain('Operating Hours: 11 AM – 12 AM');
  });
  test('no capacity saved → "Ask us", never a made-up number', () => {
    expect(v.facts[0]).toEqual({ label: 'Guests', value: ASK_US });
    expect(v.spaces).toEqual([{ name: 'AC Banquet Hall', kind: 'Indoor', seated: ASK_US, max: ASK_US }]);
  });
  test('per-plate packages, price line taken out of the points', () => {
    expect(v.facts[1]).toEqual({ label: 'Starting price', value: '₹900 / plate' });
    expect(v.packages[0]).toEqual({ id: 'p1', name: 'Veg Standard Package', price: '₹900', unit: '/ plate', points: ['Pure vegetarian menu'] });
    expect(v.facts).toContainEqual({ label: 'Guest rooms', value: '5 rooms' });
  });
  test('events from its own description; empty FAQs dropped; rating shown only with reviews', () => {
    expect(v.events).toEqual(['Weddings', 'Engagements', 'Birthdays', 'Anniversaries', 'Corporate events', 'Family functions']);
    expect(v.faqs).toEqual([{ q: 'Q?', a: 'A.' }]);
    expect(v.onlineRating).toEqual({ value: '5.0', count: 1 });
  });
});

describe('toVenueView — Ashiyana Resort', () => {
  const v = toVenueView(ashiyana);
  test('hall and lawn with their capacities, from the capacity lines', () => {
    expect(v.spaces).toEqual([
      { name: 'Hall', kind: 'Indoor', seated: '300', max: '450' },
      { name: 'Lawn', kind: 'Outdoor', seated: '400', max: '600' },
    ]);
    expect(v.amenities).not.toContain('Hall Capacity: 300 Seated / 450 Max');
  });
  test('facts: capacity, plate price from the cheapest package (not its 2.5 lakh range), spaces, rooms', () => {
    expect(v.facts).toEqual([
      { label: 'Guests', value: 'Up to 1,000' },
      { label: 'Starting price', value: '₹900 / plate' },
      { label: 'Spaces', value: 'Hall + Lawn' },
      { label: 'Guest rooms', value: '10 rooms' },
    ]);
  });
  test('kind from its venue type; duplicate photos shown once; Rukanpura from the address', () => {
    expect(v.kind).toBe('Resort · Banquet Hall · Lawn · Rooms');
    expect(v.photos).toEqual(['x.jpg', 'y.jpg']);
    expect(v.place).toBe('Rukanpura, Patna');
    expect(v.events).toEqual(['Weddings', 'Celebrations']);
  });
});

describe('a listing with almost nothing saved', () => {
  const v = toVenueView({ slug: 's', name: 'New Venue', city: 'Patna', priceMin: 0, priceMax: 0, rating: 4.5, reviewCount: 0 });
  test('nothing blank, nothing invented', () => {
    expect(v.place).toBe('Patna');
    expect(v.address).toBe('Patna');
    expect(v.kind).toBe('Wedding venue');
    expect(v.facts).toEqual([{ label: 'Guests', value: ASK_US }, { label: 'Starting price', value: ASK_US }]);
    expect(v.onlineRating).toBeNull();
    expect(v.photos).toEqual([]);
    expect(v.spaces).toEqual([]);
    expect(v.packages).toEqual([]);
    expect(v.video).toBeNull();
    expect(v.mapsLink).toContain('New%20Venue');
  });
});

describe('helpers', () => {
  test('admin-set area wins over the address', () => expect(venuePlace({ area: 'boring-road', address: 'X, Y, Patna', city: 'Patna' })).toBe('Boring Road, Patna'));
  test('changing rooms are not guest rooms', () => expect(venueRooms(['4 AC Changing Rooms'])).toBeNull());
  test('"X + Y" summary lines are not a space', () => expect(venueSpaces(['Indoor Banquet Hall + Outdoor Lawn'], null)).toEqual([]));
  test('no events mentioned → none', () => expect(venueEvents('A lovely place.')).toEqual([]));
  test('a flat package price', () => expect(venueStartingPrice({ slug: 's', name: 'n', city: 'Patna', priceMin: 150000, priceMax: 350000, rating: 0, reviewCount: 0 })).toBe('₹1,50,000'));
});
