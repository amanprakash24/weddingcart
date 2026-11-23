import { describe, expect, it } from 'bun:test';
import { askAgainOutcome, normaliseMobile, ownVendorProblem, staffMoveProblem } from './coupleVendors';

describe('outside vendors', () => {
  const ok = { name: 'Raju Photo Studio', category: 'Photographer', phone: '+91 98765 43210', price: 45000, notes: 'Candid + traditional' };
  it('a complete vendor passes; only name and service are required', () => {
    expect(ownVendorProblem(ok)).toBeNull();
    expect(ownVendorProblem({ name: 'Mehndi Didi', category: 'Mehndi artist' })).toBeNull();
  });
  it('names, services, phone, price and notes are checked', () => {
    expect(ownVendorProblem({ ...ok, name: ' ' })).toContain('name');
    expect(ownVendorProblem({ ...ok, category: '' })).toContain('what they do');
    expect(ownVendorProblem({ ...ok, phone: '12345' })).toContain('10-digit');
    expect(ownVendorProblem({ ...ok, price: -1 })).toContain('whole rupees');
    expect(ownVendorProblem({ ...ok, price: 10.5 })).toContain('whole rupees');
    expect(ownVendorProblem({ ...ok, notes: 'x'.repeat(501) })).toContain('500');
  });
  it('mobile numbers are normalised', () => {
    expect(normaliseMobile('+91 98765 43210')).toBe('9876543210');
    expect(normaliseMobile('098765-43210')).toBe('9876543210');
    expect(normaliseMobile('')).toBeNull();
    expect(normaliseMobile('5876543210')).toBeUndefined();
  });
});

describe('quote requests', () => {
  it('staff answer a request; an answer needs a note the couple reads', () => {
    expect(staffMoveProblem('REQUESTED', 'QUOTED', '₹45,000 for both days')).toBeNull();
    expect(staffMoveProblem('REQUESTED', 'QUOTED', ' ')).toContain('price');
    expect(staffMoveProblem('REQUESTED', 'NOT_AVAILABLE', null)).toContain('why');
    expect(staffMoveProblem('QUOTED', 'BOOKED', null)).toBeNull();
  });
  it('ends stay ends', () => {
    expect(staffMoveProblem('BOOKED', 'QUOTED', 'x')).not.toBeNull();
    expect(staffMoveProblem('CLOSED', 'REQUESTED', null)).not.toBeNull();
    expect(staffMoveProblem('BOOKED', 'CLOSED', null)).toBeNull();
  });
  it('asking again: a live request is kept, a closed or unavailable one starts again', () => {
    expect(askAgainOutcome(null)).toBe('CREATE');
    expect(askAgainOutcome('REQUESTED')).toBe('KEEP');
    expect(askAgainOutcome('QUOTED')).toBe('KEEP');
    expect(askAgainOutcome('BOOKED')).toBe('KEEP');
    expect(askAgainOutcome('CLOSED')).toBe('REOPEN');
    expect(askAgainOutcome('NOT_AVAILABLE')).toBe('REOPEN');
  });
});
