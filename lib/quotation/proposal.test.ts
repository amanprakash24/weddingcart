/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import {
  newCustomerToken,
  hashCustomerToken,
  isWellFormedToken,
  isPreviewBot,
  proposalUrl,
  proposalState,
  validateChangeNote,
  appendChangeNote,
  toCustomerProposal,
  toProposalVendor,
  toAddable,
  validateEventRequest,
  eventRequestNote,
  type ProposalQuotationInput,
  type ProposalVendorInput,
} from './proposal';

const NOW = new Date('2026-10-01T10:00:00Z');
const FUTURE = new Date('2026-10-20T00:00:00Z');
const PAST = new Date('2026-09-20T00:00:00Z');

describe('customer token', () => {
  test('is 43 URL-safe characters (256 bits) and different every time', () => {
    const tokens = new Set(Array.from({ length: 200 }, newCustomerToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(isWellFormedToken(t)).toBe(true);
  });

  test('only the SHA-256 hash is derived for storage; the hash does not contain the token', () => {
    const t = newCustomerToken();
    const h = hashCustomerToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(t);
    expect(hashCustomerToken(t)).toBe(h);
    expect(hashCustomerToken(newCustomerToken())).not.toBe(h);
  });

  test('malformed tokens are rejected before any lookup', () => {
    for (const bad of [undefined, null, 42, '', 'abc', 'x'.repeat(42), 'x'.repeat(44), `${'x'.repeat(42)}/`, `${'x'.repeat(42)}.`]) {
      expect(isWellFormedToken(bad)).toBe(false);
    }
  });

  test('link-preview bots are recognised; normal browsers are not', () => {
    for (const ua of ['WhatsApp/2.23.20.0 A', 'facebookexternalhit/1.1', 'TelegramBot (like TwitterBot)', 'Slackbot-LinkExpanding 1.0', 'Googlebot/2.1']) {
      expect(isPreviewBot(ua)).toBe(true);
    }
    for (const ua of ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5) Safari/604.1', null]) {
      expect(isPreviewBot(ua)).toBe(false);
    }
  });

  test('proposal URL', () => {
    expect(proposalUrl('https://www.shaadishopping.com/', 'T')).toBe('https://www.shaadishopping.com/proposal/T');
  });
});

describe('proposalState', () => {
  test('SENT and still valid → OPEN', () => {
    expect(proposalState({ status: 'SENT', validUntil: FUTURE }, NOW)).toBe('OPEN');
  });
  test('SENT past its valid-until (not yet flipped) → EXPIRED', () => {
    expect(proposalState({ status: 'SENT', validUntil: PAST }, NOW)).toBe('EXPIRED');
    expect(proposalState({ status: 'SENT', validUntil: null }, NOW)).toBe('EXPIRED');
  });
  test('EXPIRED → EXPIRED, ACCEPTED → ACCEPTED (stays viewable, no 30-day cut-off)', () => {
    expect(proposalState({ status: 'EXPIRED', validUntil: PAST }, NOW)).toBe('EXPIRED');
    expect(proposalState({ status: 'ACCEPTED', validUntil: PAST }, NOW)).toBe('ACCEPTED');
  });
  test.each(['DRAFT', 'SUPERSEDED', 'REJECTED'] as const)('%s → INVALID (generic page)', (status) => {
    expect(proposalState({ status, validUntil: FUTURE }, NOW)).toBe('INVALID');
  });
});

describe('change note', () => {
  test('trimmed, required, max 1000 characters', () => {
    expect(validateChangeNote('  Please reduce decoration  ')).toBe('Please reduce decoration');
    expect(() => validateChangeNote('   ')).toThrow();
    expect(() => validateChangeNote(undefined)).toThrow();
    expect(() => validateChangeNote('x'.repeat(1001))).toThrow();
    expect(validateChangeNote('x'.repeat(1000))).toHaveLength(1000);
  });
  test('a second request is appended, never replacing the first', () => {
    const first = appendChangeNote(null, 'Reduce decoration', NOW);
    const both = appendChangeNote(first, 'Catering 300 guests', NOW);
    expect(both).toContain('Reduce decoration');
    expect(both).toContain('Catering 300 guests');
  });
});

describe('toCustomerProposal — allow-list only', () => {
  const quotation = {
    id: 'q-uuid-secret',
    quotationNumber: 'QTN-202610-0007',
    revision: 2,
    status: 'SENT',
    validUntil: FUTURE,
    acceptedAt: null,
    changesRequestedAt: null,
    subtotal: 405000,
    discount: 5000,
    gstEnabled: false,
    gstAmount: 999,
    total: 400000,
    advanceAmount: 100000,
    terms: '50% refundable',
    inclusions: 'Stage, lights',
    exclusions: 'Liquor',
    notes: 'INTERNAL — margin 18%',
    customerTokenHash: 'deadbeef'.repeat(8),
    consultationId: 'consultation-uuid',
    createdById: 'staff-uuid',
    items: [
      { sortOrder: 2, description: 'Catering — 350 plates', category: 'Catering', functionLabel: 'Wedding', vendorId: 'v2', unitPrice: 500, quantity: 350 },
      { sortOrder: 1, description: 'Banquet hall', category: 'Venue', functionLabel: null, vendorId: 'v1', unitPrice: 120000, quantity: 1 },
      { sortOrder: 3, description: 'mehndi', category: 'mehndi', functionLabel: null, vendorId: null, unitPrice: 7000, quantity: 1 },
    ],
  } as unknown as ProposalQuotationInput;
  const source = { name: 'Rahul & Priya', phone: '9876543210', city: 'Patna', dateText: '2026-11-18', guestCount: 350, eventType: 'wedding' };
  const vendor = (over: Partial<ProposalVendorInput>): ProposalVendorInput => ({
    name: 'X', slug: 'x', status: 'PUBLISHED', city: 'Patna', area: null, category: 'Venues', image: '', images: [], virtualTourVideo: '', description: '', features: [],
    guestCapacity: null, venueType: null, rating: 0, reviewCount: 0, ...over,
  });
  // Dirty inputs: owner contact details etc. must never come out even if a query returned them.
  const hall = {
    ...vendor({ name: 'Swayamvar Hall', slug: 'swayamvar-hall-patna', area: 'Boring Road', image: 'https://img/hall.jpg', description: 'A grand hall.', features: ['AC hall', 'Parking'], guestCapacity: 500, venueType: 'indoor', rating: 4.5, reviewCount: 12 }),
    ownerPhone: '9999999999',
    ownerEmail: 'owner@hall.in',
  } as ProposalVendorInput;
  const caterer = vendor({ name: 'ABC Caterers', slug: 'abc-caterers', status: 'DRAFT', category: 'Catering', description: 'Unverified text', guestCapacity: 900 });
  const vendors = new Map([['v1', hall], ['v2', caterer]]);

  test('shows what the couple needs — service, who provides it, function, quantity, price', () => {
    const p = toCustomerProposal(quotation, source, vendors, NOW);
    expect(p.number).toBe('QTN-202610-0007');
    expect(p.version).toBe(2);
    expect(p.state).toBe('OPEN');
    expect(p.couple.name).toBe('Rahul & Priya');
    expect(p.wedding).toEqual({ date: '2026-11-18', guestCount: 350, city: 'Patna', eventType: 'wedding' });
    expect(p.items.map((i) => i.vendor?.name ?? null)).toEqual(['Swayamvar Hall', 'ABC Caterers', null]); // sorted by sortOrder
    expect(p.items[1]).toMatchObject({ service: 'Catering', functionLabel: 'Wedding', quantity: 350, unitPrice: 500, lineTotal: 175000 });
    expect(p.total).toBe(400000);
    expect(p.advanceAmount).toBe(100000);
    expect(p.gstAmount).toBeNull(); // GST not charged → not shown
  });

  test('an older line stored with the raw service key is shown by its name — the stored data is not changed', () => {
    const p = toCustomerProposal(quotation, source, vendors, NOW);
    expect(p.items[2]).toMatchObject({ service: 'Mehndi Artists', description: 'Mehndi Artists', vendor: null });
  });

  test('a PUBLISHED vendor shows its public profile; a vendor not published shows its name only', () => {
    const p = toCustomerProposal(quotation, source, vendors, NOW);
    expect(p.items[0].vendor).toEqual({
      name: 'Swayamvar Hall',
      profile: {
        category: 'Venues',
        location: 'Boring Road, Patna',
        image: 'https://img/hall.jpg',
        gallery: [],
        video: null,
        about: 'A grand hall.',
        features: ['AC hall', 'Parking'],
        guestCapacity: 500,
        venueType: 'indoor',
        rating: { value: 4.5, reviews: 12 },
        url: '/vendors/swayamvar-hall-patna',
      },
    });
    expect(p.items[1].vendor).toEqual({ name: 'ABC Caterers', profile: null });
  });

  test('profile details: capacity/venue type only for venues, rating only with reviews, long text shortened, at most 6 features', () => {
    const photographer = toProposalVendor(
      vendor({ category: 'Photographers', guestCapacity: 300, venueType: 'x', description: 'word '.repeat(100), features: ['1', '2', '3', '4', '5', '6', '7'] })
    );
    expect(photographer.profile?.guestCapacity).toBeNull();
    expect(photographer.profile?.venueType).toBeNull();
    expect(photographer.profile?.rating).toBeNull();
    expect(photographer.profile?.about?.length).toBeLessThanOrEqual(281);
    expect(photographer.profile?.about?.endsWith('…')).toBe(true);
    expect(photographer.profile?.features).toHaveLength(6);
  });

  test('gallery and video: the vendor’s own public media — https only, main image not repeated, at most 6, published only', () => {
    const media = {
      image: 'https://img/main.jpg',
      images: ['https://img/main.jpg', 'https://img/1.jpg', ' https://img/2.jpg ', 'http://img/insecure.jpg', 'javascript:alert(1)', '', 'https://img/1.jpg', 'https://img/3.jpg', 'https://img/4.jpg', 'https://img/5.jpg', 'https://img/6.jpg', 'https://img/7.jpg'],
      virtualTourVideo: 'https://video/tour.mp4',
    };
    const v = toProposalVendor(vendor(media));
    expect(v.profile?.gallery).toEqual(['https://img/1.jpg', 'https://img/2.jpg', 'https://img/3.jpg', 'https://img/4.jpg', 'https://img/5.jpg', 'https://img/6.jpg']);
    expect(v.profile?.video).toBe('https://video/tour.mp4');
    expect(toProposalVendor(vendor({ virtualTourVideo: 'http://video/tour.mp4' })).profile?.video).toBeNull();
    expect(toProposalVendor(vendor({ ...media, status: 'DRAFT' })).profile).toBeNull();
  });

  test('venue at the top: only when exactly one venue line names a vendor — never a generic "venue"', () => {
    expect(toCustomerProposal(quotation, source, vendors, NOW).venueName).toBe('Swayamvar Hall');
    const noVendor = { ...quotation, items: quotation.items.map((i) => ({ ...i, vendorId: null })) } as ProposalQuotationInput;
    expect(toCustomerProposal(noVendor, source, vendors, NOW).venueName).toBeNull();
    const two = {
      ...quotation,
      items: [...quotation.items, { sortOrder: 9, description: 'Lawn', category: 'Venue', functionLabel: 'Reception', vendorId: 'v3', unitPrice: 1, quantity: 1 }],
    } as ProposalQuotationInput;
    expect(toCustomerProposal(two, source, new Map([...vendors, ['v3', vendor({ name: 'Green Lawn' })]]), NOW).venueName).toBeNull();
  });

  test('confirmed vendors and "booked" only for an accepted proposal — names, function, date, venue; never a price', () => {
    const accepted = { ...quotation, status: 'ACCEPTED', acceptedAt: NOW } as ProposalQuotationInput;
    const confirmedVendors = [
      { vendorName: 'Mehak Bridal Makeup', category: 'Makeup Artists', eventType: 'WEDDING', eventLabel: null, date: new Date('2026-11-18T12:00:00Z'), venueName: null },
      { vendorName: 'Artistic Mehndi Studio', category: 'Mehndi', eventType: 'MEHNDI', eventLabel: 'Mehndi night', date: new Date('2026-11-17T12:00:00Z'), venueName: 'Home' },
    ];
    const p = toCustomerProposal(accepted, source, vendors, NOW, { booked: true, confirmedVendors });
    expect(p.booked).toBe(true);
    expect(p.confirmedVendors).toEqual([
      { name: 'Artistic Mehndi Studio', category: 'Mehndi', function: 'Mehndi night', date: '2026-11-17T12:00:00.000Z', venueName: 'Home' },
      { name: 'Mehak Bridal Makeup', category: 'Makeup Artists', function: 'WEDDING', date: '2026-11-18T12:00:00.000Z', venueName: null },
    ]);
    const open = toCustomerProposal(quotation, source, vendors, NOW, { booked: true, confirmedVendors });
    expect(open.booked).toBe(false);
    expect(open.confirmedVendors).toEqual([]);
  });

  test('never contains internal notes, ids, token hash, the customer phone or vendor owner details', () => {
    const accepted = { ...quotation, status: 'ACCEPTED', acceptedAt: NOW } as ProposalQuotationInput;
    const json = JSON.stringify(toCustomerProposal(accepted, source, vendors, NOW, { booked: true, confirmedVendors: [] }));
    for (const secret of ['INTERNAL', 'margin', 'q-uuid-secret', 'deadbeef', 'consultation-uuid', 'staff-uuid', '9876543210', '9999999999', 'owner@hall.in', 'Unverified text', '"v1"', '"v2"']) {
      expect(json).not.toContain(secret);
    }
    expect(Object.keys(toCustomerProposal(quotation, source, vendors, NOW)).sort()).toEqual(
      ['acceptedAt', 'addable', 'advanceAmount', 'booked', 'changesRequested', 'confirmedVendors', 'couple', 'discount', 'exclusions', 'gstAmount', 'brand', 'inclusions', 'items', 'number', 'payments', 'state', 'subtotal', 'terms', 'total', 'validUntil', 'venueName', 'version', 'wedding'].sort()
    );
    expect(Object.keys(toCustomerProposal(quotation, source, vendors, NOW).items[0]).sort()).toEqual(['description', 'functionLabel', 'lineTotal', 'quantity', 'service', 'unitPrice', 'vendor']);
  });

  test('GST is shown when charged', () => {
    expect(toCustomerProposal({ ...quotation, gstEnabled: true }, source, vendors, NOW).gstAmount).toBe(999);
  });
});

describe('Add an event', () => {
  test('toAddable: grouped in the order a wedding runs, only functions with something, only name and price words', () => {
    const groups = toAddable([
      { id: 'r1', function: 'RECEPTION', name: 'Banquet hall', price: 150000, perPlate: false },
      { id: 'h1', function: 'HALDI', name: 'Veg plate', price: 450, perPlate: true },
    ]);
    expect(groups).toEqual([
      { function: 'HALDI', label: 'Haldi', items: [{ id: 'h1', name: 'Veg plate', price: '₹450 per plate' }] },
      { function: 'RECEPTION', label: 'Reception', items: [{ id: 'r1', name: 'Banquet hall', price: '₹1,50,000' }] },
    ]);
  });

  test('validateEventRequest: a known function is required; ticks are de-duplicated and non-strings dropped; the note is trimmed', () => {
    expect(validateEventRequest({ function: 'HALDI', offeringIds: ['a', 'a', 7, '', 'b'], note: '  150 guests  ' })).toEqual({ function: 'HALDI', offeringIds: ['a', 'b'], note: '150 guests' });
    expect(validateEventRequest({ function: 'OTHER' })).toEqual({ function: 'OTHER', offeringIds: [], note: null });
    for (const bad of [null, 'HALDI', {}, { function: 'haldi' }, { function: 'PARTY' }]) expect(() => validateEventRequest(bad)).toThrow('Choose the function');
  });

  test('validateEventRequest: too many ticks or too long a note is refused', () => {
    expect(() => validateEventRequest({ function: 'HALDI', offeringIds: Array.from({ length: 13 }, (_, i) => `o${i}`) })).toThrow('up to 12');
    expect(() => validateEventRequest({ function: 'HALDI', note: 'x'.repeat(501) })).toThrow('under 500');
    expect(validateEventRequest({ function: 'HALDI', note: 'x'.repeat(500) }).note).toHaveLength(500);
  });

  test('eventRequestNote: the sentence the venue reads', () => {
    expect(eventRequestNote('HALDI', [], null)).toBe('Please add Haldi.');
    expect(eventRequestNote('HALDI', [{ name: 'Lawn', price: 25000, perPlate: false }, { name: 'Veg plate', price: 450, perPlate: true }], 'About 150 guests')).toBe(
      'Please add Haldi: Lawn (from ₹25,000), Veg plate (from ₹450 per plate).\nAbout 150 guests'
    );
  });
});
