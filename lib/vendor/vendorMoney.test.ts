import { describe, expect, test } from 'bun:test';
import { assignmentMoney, checkPayment, checkVoidReason, moneyTotals, vendorTotals, workStatusOf, type AssignmentFacts } from './vendorMoney';

const work = (over: Partial<AssignmentFacts> = {}): AssignmentFacts => ({
  id: 'w1',
  status: 'CONFIRMED',
  venueStatus: 'PENDING',
  agreedPrice: 10000,
  currentRate: 10,
  payout: null,
  payments: [],
  ...over,
});

describe('one work', () => {
  test('confirmed, nothing paid yet: owed, never ₹0 (the bug of 25 Nov 2026)', () => {
    expect(assignmentMoney(work())).toEqual({
      id: 'w1', workStatus: 'NOT_STARTED', owed: true, workValue: 10000, commissionRate: 10, commission: 1000, commissionIsEstimate: true, net: 9000, paid: 0, remaining: 9000, payable: 9000,
    });
  });

  test('a part payment and a voided entry', () => {
    const m = assignmentMoney(work({ payments: [{ amount: 3000, voided: false }, { amount: 5000, voided: true }] }));
    expect(m).toMatchObject({ paid: 3000, remaining: 6000 });
  });

  test('an older payout marked paid counts as paid, with its own commission (not today’s rate)', () => {
    const m = assignmentMoney(work({ status: 'COMPLETED', agreedPrice: 75000, currentRate: 15, payout: { status: 'PAID', commissionRate: 10, commissionAmount: 7500, netAmount: 67500 } }));
    expect(m).toMatchObject({ workStatus: 'COMPLETED', commission: 7500, commissionRate: 10, commissionIsEstimate: false, net: 67500, paid: 67500, remaining: 0 });
  });

  test('a payout calculated but not paid: nothing paid yet', () => {
    expect(assignmentMoney(work({ status: 'COMPLETED', payout: { status: 'PENDING', commissionRate: 10, commissionAmount: 1000, netAmount: 9000 } }))).toMatchObject({ paid: 0, remaining: 9000 });
  });

  test('declined and cancelled work is not owed; money paid on it shows as overpaid', () => {
    expect(assignmentMoney(work({ status: 'CANCELLED' }))).toMatchObject({ owed: false, workValue: 0, net: 0, remaining: 0, workStatus: 'CANCELLED' });
    expect(assignmentMoney(work({ status: 'CANCELLED', payments: [{ amount: 2000, voided: false }] }))).toMatchObject({ paid: 2000, remaining: -2000 });
    expect(assignmentMoney(work({ status: 'DECLINED' }))).toMatchObject({ owed: false, workStatus: 'DECLINED' });
  });

  test('no commission rate set up: unknown (null), never guessed and never ₹0', () => {
    expect(assignmentMoney(work({ currentRate: null }))).toMatchObject({ commission: null, net: null, remaining: null, workValue: 10000 });
  });

  test('work status', () => {
    expect(workStatusOf('PENDING_VENDOR_CONFIRMATION', 'PENDING')).toBe('AWAITING_VENDOR');
    expect(workStatusOf('CONFIRMED', 'PENDING')).toBe('NOT_STARTED');
    expect(workStatusOf('CONFIRMED', 'SETUP_IN_PROGRESS')).toBe('IN_PROGRESS');
    expect(workStatusOf('CONFIRMED', 'COMPLETED')).toBe('IN_PROGRESS'); // setup done, work not closed yet
    expect(workStatusOf('COMPLETED', 'PENDING')).toBe('COMPLETED');
  });
});

describe('totals — Maa Durga on WED-2026-0002 (25 Nov 2026 records)', () => {
  const facts = [
    work({ id: 'haldi', agreedPrice: 8000 }),
    work({ id: 'sangeet', agreedPrice: 10000 }),
    work({ id: 'tilak', agreedPrice: 10000 }),
    ...[1, 6000, 4500, 40000, 8000, 6000, 10000, 9000].map((p, i) => work({ id: `c${i}`, status: 'CANCELLED', agreedPrice: p })),
  ];
  const all = facts.map((f) => ({ id: f.id, status: f.status, agreedPrice: f.agreedPrice }));

  test('the three confirmed works only: ₹28,000 of work, ₹25,200 to receive, nothing paid', () => {
    expect(moneyTotals(facts.map(assignmentMoney), all)).toEqual({ workValue: 28000, commission: 2800, net: 25200, paid: 0, remaining: 25200, awaitingVendorValue: 0, works: 3, completed: 0 });
  });

  test('one unknown rate makes the totals unknown, not smaller', () => {
    const t = moneyTotals([assignmentMoney(work()), assignmentMoney(work({ id: 'x', currentRate: null }))]);
    expect(t).toMatchObject({ workValue: 20000, commission: null, net: null, remaining: null });
  });

  test('waiting for the vendor is shown apart, not owed', () => {
    const f = [work(), work({ id: 'p', status: 'PENDING_VENDOR_CONFIRMATION', agreedPrice: 5000 })];
    expect(moneyTotals(f.map(assignmentMoney), f)).toMatchObject({ workValue: 10000, awaitingVendorValue: 5000, works: 1 });
  });
});

describe('recording a payment', () => {
  const today = '2026-11-25';
  test('a good one', () => {
    expect(checkPayment({ amount: '5,000', paidOn: '2026-11-24', method: 'UPI', reference: ' 4321 ', note: '' }, 9000, today)).toEqual({
      ok: true, value: { amount: 5000, paidOn: new Date('2026-11-24T00:00:00Z'), method: 'UPI', reference: '4321', note: null },
    });
  });
  test('never more than is left, never on an unknown amount', () => {
    expect(checkPayment({ amount: 9001, paidOn: today, method: 'UPI' }, 9000, today)).toMatchObject({ ok: false });
    expect(checkPayment({ amount: 1, paidOn: today, method: 'UPI' }, 0, today)).toMatchObject({ ok: false, error: 'Nothing is left to pay on this work' });
    expect(checkPayment({ amount: 1, paidOn: today, method: 'UPI' }, null, today)).toMatchObject({ ok: false });
  });
  test('bad amounts, dates and methods', () => {
    expect(checkPayment({ amount: 0, paidOn: today, method: 'UPI' }, 9000, today)).toMatchObject({ ok: false });
    expect(checkPayment({ amount: 10.5, paidOn: today, method: 'UPI' }, 9000, today)).toMatchObject({ ok: false });
    expect(checkPayment({ amount: 10, paidOn: '2026-11-26', method: 'UPI' }, 9000, today)).toMatchObject({ ok: false, error: 'The date cannot be in the future' });
    expect(checkPayment({ amount: 10, paidOn: '2026-02-30', method: 'UPI' }, 9000, today)).toMatchObject({ ok: false });
    expect(checkPayment({ amount: 10, paidOn: today, method: 'BITCOIN' }, 9000, today)).toMatchObject({ ok: false });
  });
  test('voiding needs a reason', () => {
    expect(checkVoidReason(' ')).toMatchObject({ ok: false });
    expect(checkVoidReason('Typed 50,000 instead of 5,000')).toEqual({ ok: true, value: 'Typed 50,000 instead of 5,000' });
  });
});

describe('what a vendor may see (25 Nov 2026, money design rule 1)', () => {
  test('payable: the vendor’s own amount whatever the status — waiting, confirmed, from a payout; unknown without a rate', () => {
    expect(assignmentMoney(work({ status: 'PENDING_VENDOR_CONFIRMATION' })).payable).toBe(9000); // what they would be paid
    expect(assignmentMoney(work()).payable).toBe(9000);
    expect(assignmentMoney(work({ status: 'COMPLETED', agreedPrice: 75000, currentRate: 15, payout: { status: 'PAID', commissionRate: 10, commissionAmount: 7500, netAmount: 67500 } })).payable).toBe(67500);
    expect(assignmentMoney(work({ currentRate: null })).payable).toBeNull();
  });

  test('vendor totals carry only payable, received and left — no work value, commission or client price', () => {
    const rows = [work({ id: 'a', agreedPrice: 8000 }), work({ id: 'b', agreedPrice: 10000, payments: [{ amount: 3000, voided: false }] }), work({ id: 'c', status: 'PENDING_VENDOR_CONFIRMATION', agreedPrice: 5000 }), work({ id: 'd', status: 'CANCELLED', agreedPrice: 40000 })].map(assignmentMoney);
    const t = vendorTotals(rows);
    expect(t).toEqual({ payable: 16200, paid: 3000, remaining: 13200, awaitingPayable: 4500, works: 2, completed: 0 });
    expect(Object.keys(t).sort()).toEqual(['awaitingPayable', 'completed', 'paid', 'payable', 'remaining', 'works']);
  });
});
