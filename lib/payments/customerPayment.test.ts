/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { ValidationError } from '@/lib/errors';
import { buildAgreementMoney } from '@/lib/commercial/view';
import { PENDING_MAX, checkProof, groupReceipts, normaliseUtr, receiptNumber, toProposalPayments, validatePaymentClaim } from './customerPayment';
import { upiLink, upiPayeeFrom } from './upi';

const NOW = new Date('2026-10-03T06:00:00Z');

describe('UPI payee and link', () => {
  test('no payee unless both a valid UPI ID and a name are configured', () => {
    expect(upiPayeeFrom({})).toBeNull();
    expect(upiPayeeFrom({ SHAADI_UPI_ID: 'shaadishopping@okicici' })).toBeNull();
    expect(upiPayeeFrom({ SHAADI_UPI_ID: 'not a vpa', SHAADI_UPI_NAME: 'Shaadi Shopping' })).toBeNull();
    expect(upiPayeeFrom({ SHAADI_UPI_ID: ' shaadishopping@okicici ', SHAADI_UPI_NAME: ' Shaadi Shopping ' })).toEqual({ vpa: 'shaadishopping@okicici', payee: 'Shaadi Shopping' });
  });

  test('the link carries the payee, a fixed rupee amount, INR and the quotation number', () => {
    const link = upiLink({ vpa: 'shaadishopping@okicici', payee: 'Shaadi Shopping' }, 50000, 'QTN-202610-0001');
    expect(link).toBe('upi://pay?pa=shaadishopping@okicici&pn=Shaadi%20Shopping&am=50000.00&cu=INR&tn=QTN-202610-0001');
  });
});

describe('"I have paid" — the claim', () => {
  const ctx = { outstanding: 200000, now: NOW };

  test('a valid claim is normalised', () => {
    expect(validatePaymentClaim({ amount: '50,000', utr: '4123 4567 8901', paidOn: '2026-10-02', note: '  advance  ' }, ctx)).toEqual({
      amount: 50000, utr: '412345678901', paidOn: new Date('2026-10-02T12:00:00+05:30'), note: 'advance',
    });
    expect(validatePaymentClaim({ amount: 1, utr: 'abc123' }, ctx).paidOn).toEqual(NOW);
  });

  test('amount must be whole rupees and not more than is due', () => {
    for (const amount of [0, -5, 10.5, 'abc', '']) expect(() => validatePaymentClaim({ amount, utr: '412345678901' }, ctx)).toThrow(ValidationError);
    expect(() => validatePaymentClaim({ amount: 200001, utr: '412345678901' }, ctx)).toThrow('more than what is due');
    expect(() => validatePaymentClaim({ amount: 1, utr: '412345678901' }, { outstanding: 0, now: NOW })).toThrow('Nothing more is due');
  });

  test('the UTR is required and must look like one', () => {
    for (const utr of ['', '12345', 'has spaces!', undefined, 'x'.repeat(36)]) expect(() => validatePaymentClaim({ amount: 100, utr }, ctx)).toThrow('UTR');
    expect(normaliseUtr(' 4123-4567-8901 ')).toBe('412345678901');
  });

  test('the date cannot be in the future or too long ago', () => {
    expect(() => validatePaymentClaim({ amount: 100, utr: '412345678901', paidOn: '2026-10-06' }, ctx)).toThrow('future');
    expect(() => validatePaymentClaim({ amount: 100, utr: '412345678901', paidOn: '2026-01-01' }, ctx)).toThrow('too long ago');
    expect(() => validatePaymentClaim({ amount: 100, utr: '412345678901', paidOn: 'not a date' }, ctx)).toThrow(ValidationError);
  });

  test('the screenshot is optional, a photo or PDF, under 5 MB', () => {
    expect(checkProof(null)).toBeNull();
    expect(checkProof({ type: 'image/jpeg', size: 0 })).toBeNull();
    expect(checkProof({ type: 'image/png', size: 1000 })).toBeNull();
    expect(checkProof({ type: 'application/pdf', size: 1000 })).toBeNull();
    expect(checkProof({ type: 'text/html', size: 1000 })).toContain('photo');
    expect(checkProof({ type: 'image/jpeg', size: 6 * 1024 * 1024 })).toContain('5 MB');
  });
});

describe('receipts', () => {
  test('a payment split across the advance and balance invoices is ONE receipt', () => {
    const receipts = groupReceipts([
      { id: 'p1', invoiceNumber: 'INV-1', kind: 'ADVANCE', amount: 50000, method: 'UPI', reference: '412345678901', paidAt: '2026-10-02T06:00:00.000Z', recordedByName: 'Staff', receiptId: 'aaaabbbb-cccc' },
      { id: 'p2', invoiceNumber: 'INV-2', kind: 'BALANCE', amount: 10000, method: 'UPI', reference: '412345678901', paidAt: '2026-10-02T06:00:00.000Z', recordedByName: 'Staff', receiptId: 'aaaabbbb-cccc' },
      { id: 'p3-razorpay', invoiceNumber: 'INV-2', kind: 'BALANCE', amount: 5000, method: 'card', reference: null, paidAt: '2026-10-03T06:00:00.000Z', recordedByName: null, receiptId: null },
    ]);
    expect(receipts).toEqual([
      { number: 'RCPT-AAAABBBB', amount: 60000, method: 'UPI', reference: '412345678901', paidAt: '2026-10-02T06:00:00.000Z' },
      { number: receiptNumber('p3-razorpay'), amount: 5000, method: 'Card', reference: null, paidAt: '2026-10-03T06:00:00.000Z' },
    ]);
    expect(JSON.stringify(receipts)).not.toContain('Staff');
  });
});

describe('what the couple sees', () => {
  const money = (received: number, opts: { holdStartedAt?: Date | null; confirmed?: boolean } = {}) =>
    buildAgreementMoney({
      quotationId: 'q1',
      agreement: { bookingId: 'b1', agreementTotal: 200000, confirmationPercent: 25, confirmationAmount: 50000, holdWindowDays: 7, holdStartedAt: opts.holdStartedAt ?? null },
      invoices: [{ id: 'i1', invoiceNumber: 'INV-1', kind: 'ADVANCE', status: 'SENT', total: 50000, payments: received ? [{ id: 'p1', amount: received, method: 'UPI', status: 'SUCCESS', paidAt: '2026-10-01T06:00:00Z', recordedByName: 'Staff', receiptId: 'r1' }] : [] }],
      bookingConfirmed: opts.confirmed ?? false,
      now: NOW,
    });
  const upi = { vpa: 'shaadishopping@okicici', payee: 'Shaadi Shopping' };

  test('nothing paid: pay the confirmation amount', () => {
    const p = toProposalPayments(money(0), [], upi);
    expect(p).toMatchObject({ state: 'NOT_STARTED', total: 200000, confirmationAmount: 50000, received: 0, outstanding: 200000, remainingToConfirm: 50000, payNow: 50000, dueDate: null, canSubmit: true });
  });

  test('part paid: the date is held, the due date is when the hold ends, the rest confirms', () => {
    const p = toProposalPayments(money(20000, { holdStartedAt: new Date('2026-10-01T06:00:00Z') }), [], upi);
    expect(p).toMatchObject({ state: 'DATE_HELD', received: 20000, remainingToConfirm: 30000, payNow: 30000, dueDate: '2026-10-08T06:00:00.000Z' });
  });

  test('confirmed: the suggestion is the whole balance', () => {
    const p = toProposalPayments(money(50000, { confirmed: true }), [], upi);
    expect(p).toMatchObject({ bookingConfirmed: true, remainingToConfirm: 0, payNow: 150000, dueDate: null });
  });

  test('claims are shown, never counted; verified ones become receipts; too many open claims stop new ones', () => {
    const subs = [
      { id: 's1', amount: 10000, utr: 'A1', createdAt: '2026-10-02T06:00:00Z', status: 'PENDING' as const, rejectReason: null },
      { id: 's2', amount: 20000, utr: 'A2', createdAt: '2026-10-01T06:00:00Z', status: 'VERIFIED' as const, rejectReason: null },
      { id: 's3', amount: 5000, utr: 'A3', createdAt: '2026-10-03T06:00:00Z', status: 'REJECTED' as const, rejectReason: 'Not found in the bank' },
    ];
    const p = toProposalPayments(money(20000), subs, upi);
    expect(p.received).toBe(20000);
    expect(p.inReview).toBe(10000);
    expect(p.submissions.map((s) => s.id)).toEqual(['s3', 's1']);
    expect(p.receipts).toHaveLength(1);
    const many = Array.from({ length: PENDING_MAX }, (_, i) => ({ ...subs[0], id: `p${i}` }));
    expect(toProposalPayments(money(0), many, upi).canSubmit).toBe(false);
  });

  test('allow-list: no staff names, invoice ids or proof files', () => {
    const json = JSON.stringify(toProposalPayments(money(20000), [], upi));
    for (const s of ['Staff', 'i1', 'proof', 'recordedBy']) expect(json).not.toContain(s);
  });
});
