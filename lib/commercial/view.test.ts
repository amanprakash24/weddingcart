/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { buildAgreementMoney, type AgreementMoneyInvoice } from './view';

const NOW = new Date('2026-09-22T05:00:00.000Z');
const agreement = { bookingId: 'b1', agreementTotal: 200000, confirmationPercent: 25, confirmationAmount: 50000, holdWindowDays: 7, holdStartedAt: null as Date | null };
const pay = (id: string, amount: number, over: Record<string, unknown> = {}) => ({ id, amount, method: 'UPI', status: 'SUCCESS', paidAt: NOW, ...over });
const advance = (payments: ReturnType<typeof pay>[] = []): AgreementMoneyInvoice => ({ id: 'adv', invoiceNumber: 'INV-1', kind: 'ADVANCE', status: 'SENT', total: 50000, payments });
const balance = (payments: ReturnType<typeof pay>[] = []): AgreementMoneyInvoice => ({ id: 'bal', invoiceNumber: 'INV-2', kind: 'BALANCE', status: 'SENT', total: 150000, payments });
const view = (over: Partial<Parameters<typeof buildAgreementMoney>[0]> = {}) => buildAgreementMoney({ quotationId: 'q1', quotationNumber: 'QTN-1', agreement, invoices: [advance()], bookingConfirmed: false, now: NOW, ...over });

describe('the ₹2,00,000 example, end to end', () => {
  test('booking created, nothing paid: ₹50,000 to confirm, whole ₹2,00,000 outstanding', () => {
    const v = view();
    expect(v).toMatchObject({ state: 'NOT_STARTED', confirmationAmount: 50000, received: 0, remaining: 50000, outstanding: 200000, bookingConfirmed: false, readyToConfirm: false, stateLabel: 'No payment yet' });
    expect(v.next).toMatchObject({ kind: 'RECORD_PAYMENT', invoiceNumber: 'INV-1' });
    expect(v.next.label).toContain('₹50,000');
  });

  test('₹20,000 received: Date Held, ₹30,000 remaining, 7 of 7 days, ₹1,80,000 outstanding', () => {
    const v = view({ agreement: { ...agreement, holdStartedAt: NOW }, invoices: [advance([pay('p1', 20000)])] });
    expect(v).toMatchObject({ state: 'DATE_HELD', received: 20000, remaining: 30000, daysLeft: 7, overdue: false, outstanding: 180000, stateLabel: 'Date held — 7 of 7 days left', bookingConfirmed: false, readyToConfirm: false });
    expect(v.message).toBe('₹30,000 more required to confirm this booking. 7 of 7 days left to hold the date.');
    expect(v.next).toMatchObject({ kind: 'RECORD_PAYMENT', invoiceNumber: 'INV-1' });
    expect(v.next.label).toContain('₹30,000 more');
  });

  test('another ₹30,000: the required amount is in — ready to confirm, until the booking is actually confirmed', () => {
    const v = view({ agreement: { ...agreement, holdStartedAt: NOW }, invoices: [advance([pay('p1', 20000), pay('p2', 30000)])] });
    expect(v).toMatchObject({ state: 'CONFIRMED', received: 50000, remaining: 0, readyToConfirm: true, bookingConfirmed: false, stateLabel: 'Ready to confirm', outstanding: 150000 });
    expect(v.next.kind).toBe('CONFIRM_BOOKING');
  });

  test('confirmed: ₹1,50,000 remains, and the next action is the balance', () => {
    const v = view({ agreement: { ...agreement, holdStartedAt: NOW }, invoices: [advance([pay('p1', 50000)])], bookingConfirmed: true, weddingId: 'w1' });
    expect(v).toMatchObject({ bookingConfirmed: true, readyToConfirm: false, stateLabel: 'Booking confirmed', outstanding: 150000, weddingId: 'w1' });
    expect(v.next).toMatchObject({ kind: 'COLLECT_BALANCE', invoiceNumber: null });
    expect(v.next.label).toBe('Payment of ₹1,50,000 pending');
  });
});

describe('payments above 25%', () => {
  test('₹70,000 = ₹50,000 on the advance + ₹20,000 on the balance; totals stay exact', () => {
    const v = view({
      agreement: { ...agreement, holdStartedAt: NOW },
      invoices: [advance([pay('p1', 50000, { receiptId: 'r1' })]), balance([pay('p2', 20000, { receiptId: 'r1' })])],
      bookingConfirmed: true,
    });
    expect(v).toMatchObject({ received: 70000, outstanding: 130000, state: 'CONFIRMED' });
    expect(v.invoices.map((i) => [i.invoiceNumber, i.paid, i.outstanding])).toEqual([['INV-1', 50000, 0], ['INV-2', 20000, 130000]]);
    expect(v.next).toMatchObject({ kind: 'COLLECT_BALANCE', invoiceNumber: 'INV-2' });
  });
  test('fully paid', () => {
    const v = view({ invoices: [advance([pay('p1', 50000)]), balance([pay('p2', 150000)])], bookingConfirmed: true });
    expect(v).toMatchObject({ outstanding: 0, next: { kind: 'DONE' } });
  });
});

describe('the hold window', () => {
  const started = new Date('2026-09-14T05:00:00.000Z');
  test('over the window without reaching 25%: still Date Held, overdue, and the card says a person must decide', () => {
    const v = view({ agreement: { ...agreement, holdStartedAt: started }, invoices: [advance([pay('p1', 20000, { paidAt: started })])] });
    expect(v).toMatchObject({ state: 'DATE_HELD', overdue: true, daysLeft: -1, remaining: 30000, stateLabel: 'Date held — hold period over' });
    expect(v.message).toContain('decide');
  });
});

describe('what counts as received', () => {
  test('only successful payments, only on this agreement’s advance/balance invoices', () => {
    const other: AgreementMoneyInvoice = { id: 'x', invoiceNumber: 'INV-9', kind: 'OTHER', status: 'PAID', total: 99999, payments: [pay('px', 99999)] };
    const v = view({ invoices: [advance([pay('p1', 20000), pay('p2', 30000, { status: 'FAILED' }), pay('p3', 5000, { status: 'REFUNDED' })]), other] });
    expect(v.received).toBe(20000);
    expect(v.payments.map((p) => p.id)).toEqual(['p1']);
  });
  test('payment history carries the reference and who recorded it', () => {
    const v = view({ invoices: [advance([pay('p1', 20000, { reference: 'UTR123', recordedByName: 'Gaurav' })])] });
    expect(v.payments[0]).toMatchObject({ reference: 'UTR123', recordedByName: 'Gaurav', invoiceNumber: 'INV-1', amount: 20000 });
  });
});

describe('no agreement yet (a CRM quotation nobody has paid against)', () => {
  test('previews what would be required from the accepted total, using the current rule', () => {
    const v = buildAgreementMoney({ quotationId: 'q2', agreement: null, previewTotal: 100001, invoices: [], bookingConfirmed: false, now: NOW });
    expect(v).toMatchObject({ exists: false, confirmationAmount: 25001, agreementTotal: 100001, received: 0, state: 'NOT_STARTED', outstanding: 100001 });
  });
});
