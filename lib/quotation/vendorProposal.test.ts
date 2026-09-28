/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { toVendorProposal, toVendorProposalSummary, vendorProposalStatus, type VendorProposalInput } from './vendorProposal';

const source = { name: 'Rahul & Priya', phone: '9876543210', city: 'Patna', dateText: '2026-11-18', guestCount: 350, eventType: 'wedding' };

// Deliberately "dirty" input: extra fields a careless query might return must never come out.
const quotation = {
  id: '11111111-1111-1111-1111-111111111111',
  quotationNumber: 'QTN-202610-0007',
  revision: 2,
  discount: 4321,
  total: 400000,
  notes: 'INTERNAL margin 18%',
  customerTokenHash: 'deadbeef'.repeat(8),
  items: [
    { vendorId: 'vendor-A', sortOrder: 2, description: 'Stage decoration', category: 'Decoration', functionLabel: 'Wedding', unitPrice: 80000, quantity: 1 },
    { vendorId: 'vendor-B', sortOrder: 1, description: 'Catering — 350 plates', category: 'Catering', functionLabel: 'Wedding', unitPrice: 900, quantity: 350 },
    { vendorId: 'vendor-A', sortOrder: 3, description: 'Mandap flowers', category: 'Decoration', functionLabel: 'Haldi', unitPrice: 15000, quantity: 2 },
  ],
  booking: null,
} as unknown as VendorProposalInput;

describe('toVendorProposal — the vendor sees only their own work', () => {
  test('only this vendor\'s lines, in order, with line totals and their own total', () => {
    const p = toVendorProposal(quotation, 'vendor-A', source);
    expect(p.lines.map((l) => l.description)).toEqual(['Stage decoration', 'Mandap flowers']);
    expect(p.lines[1]).toEqual({ category: 'Decoration', functionLabel: 'Haldi', description: 'Mandap flowers', quantity: 2, unitPrice: 15000, lineTotal: 30000 });
    expect(p.total).toBe(110000); // 80,000 + 30,000 — never the quotation total, never B's catering
    expect(p.status).toBe('ACCEPTED');
    expect(p.wedding).toEqual({ name: 'Rahul & Priya', date: '2026-11-18', guestCount: 350, city: 'Patna', eventType: 'wedding' });
    expect(p.venue).toEqual([]); // no wedding yet → no venue details
  });

  test('another vendor on the same quotation sees only theirs', () => {
    const b = toVendorProposal(quotation, 'vendor-B', source);
    expect(b.lines.map((l) => l.description)).toEqual(['Catering — 350 plates']);
    expect(b.total).toBe(315000);
  });

  test('a vendor with no line gets an empty view (the service turns that into "not found")', () => {
    expect(toVendorProposal(quotation, 'vendor-C', source).lines).toEqual([]);
  });

  test('exact output keys — nothing else can leave the server', () => {
    const p = toVendorProposal(quotation, 'vendor-A', source);
    expect(Object.keys(p).sort()).toEqual(['id', 'lines', 'number', 'status', 'total', 'venue', 'version', 'wedding']);
    expect(Object.keys(p.wedding).sort()).toEqual(['city', 'date', 'eventType', 'guestCount', 'name']);
    expect(Object.keys(p.lines[0]).sort()).toEqual(['category', 'description', 'functionLabel', 'lineTotal', 'quantity', 'unitPrice']);
    const json = JSON.stringify(p);
    for (const hidden of ['9876543210', 'INTERNAL', 'margin', 'deadbeef', 'vendor-A', 'vendor-B', 'Catering', '400000', '4321', 'discount', 'notes']) {
      expect(json).not.toContain(hidden);
    }
  });

  test('once the wedding exists: BOOKED, confirmed wedding facts, and the venue of the functions this vendor is booked for', () => {
    const booked = {
      ...quotation,
      booking: {
        status: 'CONFIRMED',
        wedding: {
          weddingNumber: 'WED-2026-0003',
          primaryDate: new Date('2026-11-18T00:00:00Z'),
          city: 'Patna',
          guestCount: 400,
          weddingType: 'Hindu wedding',
          events: [{ type: 'WEDDING', label: null, date: new Date('2026-11-18T12:00:00Z'), startTime: '19:00', venueName: 'Swayamvar Hall', venueAddress: 'Boring Road', city: 'Patna' }],
        },
      },
    } as unknown as VendorProposalInput;
    const p = toVendorProposal(booked, 'vendor-A', source);
    expect(p.status).toBe('BOOKED');
    expect(p.wedding.guestCount).toBe(400);
    expect(p.wedding.date).toBe('2026-11-18T00:00:00.000Z');
    expect(p.venue).toEqual([{ function: 'WEDDING', date: '2026-11-18T12:00:00.000Z', startTime: '19:00', venueName: 'Swayamvar Hall', venueAddress: 'Boring Road', city: 'Patna' }]);
    expect(JSON.stringify(p)).not.toContain('WED-2026-0003');
  });

  test('label: ACCEPTED until a booking is made from it, then BOOKED (whatever the booking status) — a label only', () => {
    expect(vendorProposalStatus(null)).toBe('ACCEPTED');
    for (const status of ['NEW', 'CONTACTED', 'CONFIRMED', 'CLOSED']) expect(vendorProposalStatus({ status, wedding: null })).toBe('BOOKED');
  });

  test('the list summary carries no lines, only the vendor\'s total', () => {
    const s = toVendorProposalSummary(toVendorProposal(quotation, 'vendor-A', source));
    expect(Object.keys(s).sort()).toEqual(['id', 'lineCount', 'number', 'status', 'total', 'version', 'wedding']);
    expect(s).toMatchObject({ total: 110000, lineCount: 2 });
  });
});
