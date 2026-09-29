/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NotFoundError } from '@/lib/errors';

// Everything is faked through createVendorProposalService(deps) — no shared module is mocked except '@/lib/prisma'
// (needed because importing the service loads the real modules). No real quotation, vendor or booking exists here.
//
// The fake database below applies the service's OWN where/select objects the way Postgres would (id, status, "has a
// line of this vendor"; only this vendor's lines; only functions this vendor is booked for). If the service ever sent
// a filter this fake doesn't understand, matches() throws — so the rule tested here is exactly the rule sent.
//
// ACCEPTED = the couple accepted → vendor access begins. BOOKED = that accepted proposal has a booking → access continues.
// So these tests check that the service asks the database the right question — not just that the UI hides things.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createVendorProposalService, vendorVisibleWhere, VendorProposalNotFoundError } = await import('./vendorProposal.service');

type Item = { vendorId: string | null; sortOrder: number; description: string; category: string | null; functionLabel: string | null; unitPrice: number; quantity: number };
type Event = { type: string; label: string | null; date: Date; startTime: string | null; venueName: string | null; venueAddress: string | null; city: string; vendorIds: string[] };
type Q = {
  id: string;
  quotationNumber: string;
  revision: number;
  status: string;
  acceptedAt: Date | null;
  leadId: string | null;
  enquiryId: string | null;
  consultationId: string | null;
  sourceStage: string;
  items: Item[];
  booking: { status: string; wedding: { weddingNumber: string; primaryDate: Date; city: string; guestCount: number | null; weddingType: string | null; events: Event[] } | null } | null;
  // Fields that must never reach a vendor — present in the "database" so a leak would show.
  notes: string;
  discount: number;
  gstAmount: number;
  total: number;
  advanceAmount: number;
  terms: string;
  inclusions: string;
  exclusions: string;
  customerTokenHash: string;
  customerViewedAt: Date;
  changesRequestNote: string;
  acceptedChannel: string;
  acceptedNote: string;
  acceptedById: string;
};

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let seq = 0;
const line = (vendorId: string | null, description: string, unitPrice: number, quantity = 1): Item => ({ vendorId, sortOrder: ++seq, description, category: 'Decoration', functionLabel: 'Wedding', unitPrice, quantity });
const quote = (n: number, status: string, items: Item[], extra: Partial<Q> = {}): Q => ({
  id: uuid(n),
  quotationNumber: `QTN-202610-${String(n).padStart(4, '0')}`,
  revision: 1,
  status,
  acceptedAt: status === 'ACCEPTED' ? new Date(Date.UTC(2026, 9, n)) : null,
  leadId: null,
  enquiryId: null,
  consultationId: `consultation-${n}`,
  sourceStage: 'WON',
  items,
  booking: null,
  notes: 'INTERNAL-NOTE margin 18%',
  discount: 4321,
  gstAmount: 777,
  total: 999999,
  advanceAmount: 250001,
  terms: 'SECRET-TERMS',
  inclusions: 'SECRET-INCLUSIONS',
  exclusions: 'SECRET-EXCLUSIONS',
  customerTokenHash: 'deadbeef'.repeat(8),
  customerViewedAt: new Date('2026-10-02T00:00:00Z'),
  changesRequestNote: 'SECRET-CHANGE-REQUEST',
  acceptedChannel: 'WHATSAPP',
  acceptedNote: 'SECRET-ACCEPT-NOTE',
  acceptedById: 'staff-uuid-1',
  ...extra,
});

let db: Q[];
function seed() {
  seq = 0;
  db = [
    // 1: accepted, vendors A and B on it, not booked yet
    quote(1, 'ACCEPTED', [line('vendor-A', 'Stage decoration', 80000), line('vendor-B', 'Catering 350 plates', 900, 350), line('vendor-A', 'Mandap flowers', 15000, 2), line(null, 'Custom photo booth', 20000)]),
    // 2: accepted AND booked (wedding exists) — A decorates the wedding, B caters the sangeet
    quote(2, 'ACCEPTED', [line('vendor-A', 'Reception decor', 120000), line('vendor-B', 'Sangeet catering', 700, 200)], {
      booking: {
        status: 'CONFIRMED',
        wedding: {
          weddingNumber: 'WED-2026-0002',
          primaryDate: new Date('2026-12-05T00:00:00Z'),
          city: 'Patna',
          guestCount: 420,
          weddingType: 'Hindu wedding',
          events: [
            { type: 'RECEPTION', label: 'Reception', date: new Date('2026-12-05T13:00:00Z'), startTime: '19:00', venueName: 'Swayamvar Hall', venueAddress: 'Boring Road', city: 'Patna', vendorIds: ['vendor-A'] },
            { type: 'SANGEET', label: 'Sangeet', date: new Date('2026-12-04T13:00:00Z'), startTime: '18:00', venueName: 'SECRET-OTHER-VENUE', venueAddress: 'Elsewhere', city: 'Patna', vendorIds: ['vendor-B'] },
          ],
        },
      },
    }),
    // 3: accepted, only vendor B
    quote(3, 'ACCEPTED', [line('vendor-B', 'Only-B lighting', 50000)]),
    // 4–9: not visible to anyone (vendor A is on each)
    quote(4, 'DRAFT', [line('vendor-A', 'Draft decor', 1)]),
    quote(5, 'SENT', [line('vendor-A', 'Sent decor', 1)]),
    quote(6, 'SENT', [line('vendor-A', 'Negotiation decor', 1)], { sourceStage: 'NEGOTIATION' }), // the couple asked for changes
    quote(7, 'EXPIRED', [line('vendor-A', 'Expired decor', 1)]),
    quote(8, 'REJECTED', [line('vendor-A', 'Rejected decor', 1)]),
    quote(9, 'SUPERSEDED', [line('vendor-A', 'Superseded decor', 1)]),
    // 10–13: accepted, then something happened to the booking or the CRM record — access is NOT affected
    quote(10, 'ACCEPTED', [line('vendor-A', 'Closed-booking decor', 1)], { booking: { status: 'CLOSED', wedding: null } }),
    quote(11, 'ACCEPTED', [line('vendor-A', 'Lost-consultation decor', 1)], { sourceStage: 'LOST' }),
    quote(12, 'ACCEPTED', [line('vendor-A', 'Lost-lead decor', 1)], { consultationId: null, leadId: 'lead-12', sourceStage: 'LOST' }),
    quote(13, 'ACCEPTED', [line('vendor-A', 'Lost-enquiry decor', 1)], { consultationId: null, enquiryId: 'enquiry-13', sourceStage: 'LOST' }),
    // 14: accepted with a booking that is not confirmed yet
    quote(14, 'ACCEPTED', [line('vendor-A', 'New-booking decor', 1)], { booking: { status: 'NEW', wedding: null } }),
  ];
}

// ---- a tiny interpreter for exactly the where/select shapes the service sends -----------------------------------
type Where = ReturnType<typeof vendorVisibleWhere>;
function matches(q: Q, where: Where): boolean {
  const unknown = Object.keys(where).filter((k) => !['id', 'status', 'items'].includes(k));
  if (unknown.length) throw new Error(`fake database: unexpected filter ${unknown.join(', ')}`);
  if (where.id !== undefined && q.id !== where.id) return false;
  if (q.status !== where.status) return false;
  return q.items.some((i) => i.vendorId === where.items.some.vendorId);
}
// The select is honoured for items and events (row filtering), but the WHOLE row is returned otherwise — as if a
// future query selected too much — so the projection's allow-list is what keeps the extra fields out.
function applySelect(q: Q, select: { items: { where: { vendorId: string } }; booking: { select: { wedding: { select: { events: { where: { vendorBookings: { some: { vendorId: string } } } } } } } } }) {
  const vendorId = select.items.where.vendorId;
  const eventVendor = select.booking.select.wedding.select.events.where.vendorBookings.some.vendorId;
  return {
    ...q,
    items: q.items.filter((i) => i.vendorId === vendorId),
    booking: q.booking && {
      ...q.booking,
      wedding: q.booking.wedding && { ...q.booking.wedding, events: q.booking.wedding.events.filter((e) => e.vendorIds.includes(eventVendor)) },
    },
  };
}

const findMany = mock(async (args: { where: Where; select: never; take: number }) =>
  db.filter((q) => matches(q, args.where)).sort((a, b) => (b.acceptedAt?.getTime() ?? 0) - (a.acceptedAt?.getTime() ?? 0)).slice(0, args.take).map((q) => applySelect(q, args.select))
);
const findFirst = mock(async (args: { where: Where; select: never }) => {
  const q = db.find((row) => matches(row, args.where));
  return q ? applySelect(q, args.select) : null;
});
const profiles = new Map([['user-A', 'vendor-A'], ['user-B', 'vendor-B'], ['user-C', 'vendor-C']]);
const vendorIdForUser = mock(async (userId: string) => {
  const v = profiles.get(userId);
  if (!v) throw new NotFoundError('Vendor profile', userId);
  return v;
});
const sourceFacts = mock(async () => ({ name: 'Rahul & Priya', phone: '9876543210', city: 'Patna', dateText: '2026-12-05', guestCount: 350, eventType: 'wedding' }));

const service = createVendorProposalService({ findMany: findMany as never, findFirst: findFirst as never, vendorIdForUser, sourceFacts: sourceFacts as never });

beforeEach(() => {
  seed();
  for (const m of [findMany, findFirst, vendorIdForUser, sourceFacts]) m.mockClear();
});

const NOT_VISIBLE = [4, 5, 6, 7, 8, 9];

describe('visibility — ACCEPTED is the access gate; a booking only changes the label', () => {
  test('1. ACCEPTED, no booking yet → vendor CAN view (label ACCEPTED)', async () => {
    expect((await service.getForVendor('user-A', uuid(1))).status).toBe('ACCEPTED');
  });

  test('2. ACCEPTED with a booking → vendor CAN view (label BOOKED) — confirmed booking or not', async () => {
    expect((await service.getForVendor('user-A', uuid(2))).status).toBe('BOOKED');
    expect((await service.getForVendor('user-A', uuid(14))).status).toBe('BOOKED');
  });

  test('3. ACCEPTED with the booking CLOSED → vendor still CAN view', async () => {
    const p = await service.getForVendor('user-A', uuid(10));
    expect(p.lines.map((l) => l.description)).toEqual(['Closed-booking decor']);
  });

  test.each([
    [11, 'consultation'],
    [12, 'lead'],
    [13, 'enquiry'],
  ])('4. ACCEPTED quotation %i whose %s is marked LOST → vendor still CAN view', async (n) => {
    expect((await service.getForVendor('user-A', uuid(n))).lines).toHaveLength(1);
  });

  test.each([
    [5, '5. SENT'],
    [6, '6. NEGOTIATION (sent; the couple asked for changes)'],
    [7, '7. EXPIRED'],
    [8, '8. REJECTED'],
    [9, '9. SUPERSEDED'],
    [4, 'DRAFT'],
  ])('quotation %i — %s → vendor cannot view (same generic not-found)', async (n) => {
    await expect(service.getForVendor('user-A', uuid(n))).rejects.toBeInstanceOf(VendorProposalNotFoundError);
  });

  test('the list holds exactly the accepted proposals vendor A is on — newest acceptance first — and none of the hidden ones', async () => {
    const list = await service.listForVendor('user-A');
    expect(list.map((p) => Number(p.number.slice(-4)))).toEqual([14, 13, 12, 11, 10, 2, 1]);
    expect(list.map((p) => p.status)).toEqual(['BOOKED', 'ACCEPTED', 'ACCEPTED', 'ACCEPTED', 'BOOKED', 'BOOKED', 'ACCEPTED']);
    for (const n of NOT_VISIBLE) expect(list.map((p) => p.number)).not.toContain(`QTN-202610-${String(n).padStart(4, '0')}`);
  });

  test('the rule sent to the database is exactly: this id (if given), status ACCEPTED, has a line of THIS vendor — nothing else', () => {
    expect(vendorVisibleWhere('vendor-A', uuid(1))).toEqual({ id: uuid(1), status: 'ACCEPTED', items: { some: { vendorId: 'vendor-A' } } });
    expect(vendorVisibleWhere('vendor-A')).toEqual({ status: 'ACCEPTED', items: { some: { vendorId: 'vendor-A' } } });
  });
});

describe('vendor isolation', () => {
  test('10. vendor A sees only vendor A\'s lines, and a total from those lines only', async () => {
    const p = await service.getForVendor('user-A', uuid(1));
    expect(p.lines.map((l) => l.description)).toEqual(['Stage decoration', 'Mandap flowers']);
    expect(p.total).toBe(80000 + 15000 * 2);
  });

  test('vendor B on the same quotation sees only vendor B\'s line', async () => {
    const p = await service.getForVendor('user-B', uuid(1));
    expect(p.lines.map((l) => l.description)).toEqual(['Catering 350 plates']);
    expect(p.total).toBe(900 * 350);
  });

  test('vendor A cannot open vendor B\'s quotation by guessing its id — same not-found as an id that does not exist', async () => {
    await expect(service.getForVendor('user-A', uuid(3))).rejects.toBeInstanceOf(VendorProposalNotFoundError);
    await expect(service.getForVendor('user-A', uuid(999))).rejects.toBeInstanceOf(VendorProposalNotFoundError);
    const a = await service.getForVendor('user-A', uuid(3)).catch((e: Error) => e.message);
    const b = await service.getForVendor('user-A', uuid(999)).catch((e: Error) => e.message);
    expect(a).toBe(b);
  });

  test('malformed ids never reach the database', async () => {
    for (const bad of ['', 'abc', '../1', `${uuid(1)}x`, null, undefined, 42, { id: uuid(1) }]) {
      await expect(service.getForVendor('user-A', bad)).rejects.toBeInstanceOf(VendorProposalNotFoundError);
    }
    expect(findFirst).not.toHaveBeenCalled();
  });

  test('the vendor comes from the logged-in user — the query is always built for that vendor', async () => {
    await service.getForVendor('user-A', uuid(1));
    const args = findFirst.mock.calls[0][0] as unknown as { where: Where; select: { items: { where: { vendorId: string } } } };
    expect(args.where.items.some.vendorId).toBe('vendor-A');
    expect(args.select.items.where.vendorId).toBe('vendor-A');
    expect(vendorIdForUser).toHaveBeenCalledWith('user-A');
  });

  test('venue details only for the functions this vendor is booked for — never another vendor\'s function or venue', async () => {
    const p = await service.getForVendor('user-A', uuid(2));
    expect(p.venue).toEqual([{ function: 'Reception', date: '2026-12-05T13:00:00.000Z', startTime: '19:00', venueName: 'Swayamvar Hall', venueAddress: 'Boring Road', city: 'Patna' }]);
    expect(JSON.stringify(p)).not.toContain('SECRET-OTHER-VENUE');
    expect(JSON.stringify(p)).not.toContain('Sangeet');
  });

  test('a vendor with no proposals gets an empty list', async () => {
    expect(await service.listForVendor('user-C')).toEqual([]);
  });

  test('responses contain no other vendor\'s id, name, line or price', async () => {
    const json = JSON.stringify([await service.getForVendor('user-A', uuid(1)), await service.getForVendor('user-A', uuid(2)), await service.listForVendor('user-A')]);
    for (const other of ['vendor-B', 'vendor-A', 'Catering', 'Sangeet catering', 'Only-B', '315000', '140000', 'Custom photo booth']) {
      expect(json).not.toContain(other);
    }
  });
});

describe('leak prevention — nothing internal leaves the server', () => {
  test('no contact details, money totals, notes, link, change request, acceptance or CRM details', async () => {
    const json = JSON.stringify([await service.getForVendor('user-A', uuid(1)), await service.getForVendor('user-A', uuid(2)), await service.listForVendor('user-A')]);
    for (const hidden of [
      '9876543210', // customer phone
      '@', // any email
      '4321', // discount
      '777', // GST
      '999999', // customer total
      '250001', // advance
      'INTERNAL-NOTE',
      'margin',
      'SECRET-TERMS',
      'SECRET-INCLUSIONS',
      'SECRET-EXCLUSIONS',
      'deadbeef', // token hash
      'SECRET-CHANGE-REQUEST',
      '2026-10-02', // customer viewed at
      'WHATSAPP', // acceptance channel
      'SECRET-ACCEPT-NOTE',
      'staff-uuid-1', // who accepted
      'consultation-', // CRM source ids
      'WON',
      'WED-2026-0002', // internal wedding number
    ]) {
      expect(json).not.toContain(hidden);
    }
  });

  test('exact keys of the detail view', async () => {
    const p = await service.getForVendor('user-A', uuid(2));
    expect(Object.keys(p).sort()).toEqual(['id', 'lines', 'number', 'status', 'total', 'venue', 'version', 'wedding']);
  });
});

describe('who may use it', () => {
  test('a logged-in user without a vendor profile (e.g. an admin or a customer) is refused before any quotation is read', async () => {
    await expect(service.listForVendor('admin-1')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getForVendor('admin-1', uuid(1))).rejects.toBeInstanceOf(NotFoundError);
    expect(findMany).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });

  test('read-only: the service only reads (the fake database has no write methods at all)', async () => {
    await service.listForVendor('user-A');
    await service.getForVendor('user-A', uuid(2));
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});
