/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Decision 10: the proposal and the detailed quotation are separate experiences. Checked on the source so the split
// can't quietly drift back into one page.
const src = readFileSync(join(import.meta.dir, '..', '..', 'components', 'proposal', 'ProposalClient.tsx'), 'utf8');
const proposalPanel = src.slice(src.indexOf('aria-label="Your proposal"'), src.indexOf('aria-label="Detailed quotation"'));
const quotationPanel = src.slice(src.indexOf('aria-label="Detailed quotation"'));

describe('proposal page — two separate experiences', () => {
  test('both panels exist, in order', () => {
    expect(proposalPanel.length).toBeGreaterThan(100);
    expect(quotationPanel.length).toBeGreaterThan(100);
  });

  test('the proposal panel shows no accounting breakdown and no Accept', () => {
    expect(proposalPanel).not.toMatch(/Subtotal|GST|quotationSummary|QuotationTable|unitPrice|onClick=\{accept\}/);
    expect(proposalPanel).toContain('proposalHighlights(p)');
  });

  test('Accept lives only in the detailed quotation, next to the terms', () => {
    expect(src.match(/onClick=\{accept\}/g)).toHaveLength(1);
    expect(quotationPanel).toContain('onClick={accept}');
    expect(quotationPanel.indexOf('title="Terms"')).toBeLessThan(quotationPanel.indexOf('onClick={accept}'));
  });

  test('the detailed quotation carries every commercial detail and can be printed', () => {
    for (const s of ['<QuotationTable', 'quotationSummary(p)', "What's included", "What's not included", 'window.print()']) expect(quotationPanel).toContain(s);
  });

  test('the Shaadi Shopping section: on a venue’s link only, on the proposal view only, never printed, after the venue’s own contact line', () => {
    const section = src.slice(src.indexOf('aria-label="Shaadi Shopping"') - 200, src.indexOf('Powered by Vivah OS'));
    expect(section).toContain("{shaadi && tab === 'proposal' && (");
    expect(section).toContain('print:hidden');
    expect(section).toContain('Shaadi Shopping is a separate service');
    expect(src.indexOf('Questions? Call')).toBeLessThan(src.indexOf('aria-label="Shaadi Shopping"'));
    expect(src.match(/aria-label="Shaadi Shopping"/g)).toHaveLength(1);
  });
});

describe('payments (Roadmap 1.3)', () => {
  const panel = readFileSync(join(import.meta.dir, '..', '..', 'components', 'proposal', 'PaymentsPanel.tsx'), 'utf8');

  test('the Payments tab exists only when the server sent a payments section', () => {
    expect(src).toContain("...(p.payments ? [['payments', 'Payments']] : [])");
    expect(src).toContain("tab === 'payments' && p.payments");
  });

  test('the QR is made on the page (no third-party QR service sees the payee or amount)', () => {
    expect(panel).toContain("from 'qrcode'");
    expect(panel).not.toMatch(/https?:\/\/[^'"\s]*qr/i);
  });

  test('a claim is only ever "being checked" — the page never adds it to what is paid', () => {
    expect(panel).not.toMatch(/received\s*\+\s*|inReview\s*\+/);
    expect(panel).toContain('Being checked');
  });
});

describe('reviews (Roadmap 1.4)', () => {
  test('the Reviews tab exists only when the server sent a reviews section (wedding completed)', () => {
    expect(src).toContain("...(p.reviews ? [['reviews', 'Reviews']] : [])");
    expect(src).toContain("tab === 'reviews' && p.reviews");
  });
});
