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
  type ProposalQuotationInput,
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
    ],
  } as unknown as ProposalQuotationInput;
  const source = { name: 'Rahul & Priya', phone: '9876543210', city: 'Patna', dateText: '2026-11-18', guestCount: 350, eventType: 'wedding' };
  const vendors = new Map([['v1', 'Swayamvar Hall'], ['v2', 'ABC Caterers']]);

  test('shows what the couple needs', () => {
    const p = toCustomerProposal(quotation, source, vendors, NOW);
    expect(p.number).toBe('QTN-202610-0007');
    expect(p.version).toBe(2);
    expect(p.state).toBe('OPEN');
    expect(p.couple.name).toBe('Rahul & Priya');
    expect(p.wedding).toEqual({ date: '2026-11-18', guestCount: 350, city: 'Patna', eventType: 'wedding' });
    expect(p.items.map((i) => i.vendorName)).toEqual(['Swayamvar Hall', 'ABC Caterers']); // sorted by sortOrder
    expect(p.items[1].lineTotal).toBe(175000);
    expect(p.total).toBe(400000);
    expect(p.advanceAmount).toBe(100000);
    expect(p.gstAmount).toBeNull(); // GST not charged → not shown
  });

  test('never contains internal notes, ids, token hash or the customer phone', () => {
    const json = JSON.stringify(toCustomerProposal(quotation, source, vendors, NOW));
    for (const secret of ['INTERNAL', 'margin', 'q-uuid-secret', 'deadbeef', 'consultation-uuid', 'staff-uuid', '9876543210', '"v1"', '"v2"']) {
      expect(json).not.toContain(secret);
    }
    expect(Object.keys(toCustomerProposal(quotation, source, vendors, NOW)).sort()).toEqual(
      ['acceptedAt', 'advanceAmount', 'changesRequested', 'couple', 'discount', 'exclusions', 'gstAmount', 'inclusions', 'items', 'number', 'state', 'subtotal', 'terms', 'total', 'validUntil', 'version', 'wedding'].sort()
    );
  });

  test('GST is shown when charged', () => {
    expect(toCustomerProposal({ ...quotation, gstEnabled: true }, source, vendors, NOW).gstAmount).toBe(999);
  });
});
