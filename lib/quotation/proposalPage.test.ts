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
});
