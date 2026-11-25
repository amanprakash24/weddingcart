// CRM quotation sharing (20 Nov 2026): the short WhatsApp message with the quotation link, the READY_TO_SHARE status between
// "link made, WhatsApp opened" and "staff confirmed it was sent", and no emoji in any pre-filled WhatsApp text.
import { describe, expect, test } from 'bun:test';
import {
  buildAcceptanceThanks,
  buildBookingConfirmedMessage,
  buildFollowUpMessage,
  buildQuotationMessage,
  buildQuotationShareMessage,
} from './message';
import {
  evaluateAcceptable,
  evaluateDeletable,
  evaluateEditable,
  evaluateRejectable,
  evaluateRevisable,
  evaluateSendable,
  evaluateShareable,
} from './rules';
import { canIssueCustomerLink, proposalState, proposalUrl, quotationUrl } from './proposal';
import { whatsappSafeText } from '@/lib/whatsappText';
import { journeyMessage, LINK_PLACEHOLDER, whatsappUrl } from '@/lib/crm/journeyMessage';
import { whatsappTo } from '@/lib/venue/enquiry';

const now = new Date('2026-11-20T06:00:00Z');
const future = new Date('2026-12-20T00:00:00Z');
const past = new Date('2026-11-01T00:00:00Z');
const URL = 'https://www.shaadishopping.com/quotation/AbC_123-xyz';
const EMOJI = /[\u{10000}-\u{10FFFF}]/u;

describe('buildQuotationShareMessage', () => {
  const text = buildQuotationShareMessage({ customerName: 'Priya Sharma', eventDate: '26 Nov 2026', quotationNumber: 'QTN-202611-0003', url: URL });

  test('carries the name, wedding date, quotation number and the real link on its own line', () => {
    expect(text.startsWith('Namaste Priya Sharma,')).toBe(true);
    expect(text).toContain('wedding on 26 Nov 2026');
    expect(text).toContain('QTN-202611-0003');
    expect(text.split('\n')).toContain(URL);
  });

  test('no price breakdown, no total, no emoji, no app/dashboard link', () => {
    expect(text).not.toContain('₹');
    expect(text.toLowerCase()).not.toContain('total');
    expect(EMOJI.test(text)).toBe(false);
    expect(text.toLowerCase()).not.toContain('open app');
    expect(text).not.toContain('/admin');
  });

  test('without a name or date it still reads naturally', () => {
    const bare = buildQuotationShareMessage({ quotationNumber: 'QTN-1', url: URL });
    expect(bare.startsWith('Namaste,')).toBe(true);
    expect(bare).toContain('for your wedding. Your quotation QTN-1 is ready.');
  });
});

describe('no emoji in any pre-filled WhatsApp message (wa.me turns them into "�")', () => {
  const q = { quotationNumber: 'QTN-1', items: [{ description: 'Hall', quantity: 1, unitPrice: 1000 }], subtotal: 1000, discount: 0, gstEnabled: false, gstAmount: 0, total: 1000, advanceAmount: 250, validUntil: future };
  test.each([
    ['quotation', buildQuotationMessage(q, 'A')],
    ['follow-up', buildFollowUpMessage(q, 'A', '1 Nov 2026')],
    ['thanks', buildAcceptanceThanks(q, 'A')],
    ['confirmed', buildBookingConfirmedMessage('A', 'WED-1', '5 Dec 2026')],
  ])('%s', (_name, text) => {
    expect(EMOJI.test(text)).toBe(false);
  });

  test('the safety net strips emoji but keeps ₹, —, ×, • and Hindi', () => {
    expect(whatsappSafeText('Namaste 🙏\nTotal ₹500 — 2 × • शुभ विवाह 🎉')).toBe('Namaste\nTotal ₹500 — 2 × • शुभ विवाह');
  });

  test('both WhatsApp link builders apply it', () => {
    expect(whatsappUrl('9876543210', 'Hi 🙏')).toBe('https://wa.me/919876543210?text=Hi');
    expect(whatsappTo('9876543210', 'Hi 🙏')).toBe('https://wa.me/919876543210?text=Hi');
    expect(whatsappUrl('9876543210', 'Hi 🙏')).not.toContain('%F0');
  });
});

describe('READY_TO_SHARE rules', () => {
  const ready = { status: 'READY_TO_SHARE' as const, itemCount: 2, validUntil: future };

  test('only a draft can be shared — a second click is refused, never a silent new link', () => {
    expect(evaluateShareable({ status: 'DRAFT', itemCount: 2, validUntil: future }, now)).toBeNull();
    expect(evaluateShareable(ready, now)?.message).toContain('already ready to share');
    expect(evaluateShareable({ status: 'SENT', itemCount: 2, validUntil: future }, now)).not.toBeNull();
  });

  test('a draft that is not finished cannot be shared', () => {
    expect(evaluateShareable({ status: 'DRAFT', itemCount: 0, validUntil: future }, now)?.message).toContain('line item');
    expect(evaluateShareable({ status: 'DRAFT', itemCount: 1, validUntil: null }, now)?.message).toContain('valid until');
    expect(evaluateShareable({ status: 'DRAFT', itemCount: 1, validUntil: past }, now)?.message).toContain('future');
  });

  test('"Yes, it\'s sent" works from READY_TO_SHARE (CRM) and DRAFT (venue flow / mark as sent), nothing else', () => {
    expect(evaluateSendable(ready, now)).toBeNull();
    expect(evaluateSendable({ ...ready, status: 'DRAFT' }, now)).toBeNull();
    expect(evaluateSendable({ ...ready, status: 'SENT' }, now)).not.toBeNull();
  });

  test('locked while ready: no edit, delete or revision — "back to draft" first', () => {
    for (const blocked of [evaluateEditable('READY_TO_SHARE'), evaluateDeletable('READY_TO_SHARE'), evaluateRevisable('READY_TO_SHARE')]) {
      expect(blocked?.message).toContain('back to draft');
    }
  });

  test('the client can accept before staff confirm; staff cannot record a decline until it is sent', () => {
    expect(evaluateAcceptable({ status: 'READY_TO_SHARE', validUntil: future }, now)).toBeNull();
    expect(evaluateAcceptable({ status: 'READY_TO_SHARE', validUntil: past }, now)).not.toBeNull();
    expect(evaluateRejectable('READY_TO_SHARE')?.message).toContain('sent');
  });

  test('the client page is open for a ready quote, and a new link can be made for it', () => {
    expect(proposalState({ status: 'READY_TO_SHARE', validUntil: future }, now)).toBe('OPEN');
    expect(proposalState({ status: 'READY_TO_SHARE', validUntil: past }, now)).toBe('EXPIRED');
    expect(proposalState({ status: 'DRAFT', validUntil: future }, now)).toBe('INVALID');
    expect(canIssueCustomerLink(proposalState({ status: 'READY_TO_SHARE', validUntil: future }, now))).toBe(true);
  });

  test('both addresses lead to the same page', () => {
    expect(quotationUrl('https://www.shaadishopping.com/', 'T1')).toBe('https://www.shaadishopping.com/quotation/T1');
    expect(proposalUrl('https://www.shaadishopping.com', 'T1')).toBe('https://www.shaadishopping.com/proposal/T1');
  });
});

describe('CRM message preview', () => {
  const q = { quotationNumber: 'QTN-202611-0003', items: [{ description: 'Hall', quantity: 1, unitPrice: 1000 }], subtotal: 1000, discount: 0, gstEnabled: false, gstAmount: 0, total: 1000, advanceAmount: 250, validUntil: future };
  const base = { quotation: q, customerName: 'Priya', eventDate: '26 Nov 2026', sentOn: null, weddingNumber: null };

  test('a draft previews the short message with a placeholder until the link exists', () => {
    const m = journeyMessage('DRAFT', base);
    expect(m?.cta).toBe('Share quotation on WhatsApp');
    expect(m?.text).toContain(LINK_PLACEHOLDER);
    expect(m?.text).not.toContain('₹');
  });

  test('ready to share shows the real link once this tab has it', () => {
    const m = journeyMessage('READY_TO_SHARE', { ...base, shareUrl: URL });
    expect(m?.text).toContain(URL);
    expect(m?.cta).toBe('Open WhatsApp again (new link)');
  });
});
