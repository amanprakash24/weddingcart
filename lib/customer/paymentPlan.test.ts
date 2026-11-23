import { describe, expect, it } from 'bun:test';
import { paymentPlan } from './paymentPlan';

describe('paymentPlan', () => {
  it('WED-2026-0002 shape: booking amount paid in two parts, balance has no fixed next amount', () => {
    const p = paymentPlan({ agreed: 85500, received: 21375, confirmationAmount: 21375, confirmationPercent: 25 });
    expect(p.due).toBe(64125);
    expect(p.next).toBeNull(); // never "Next: ₹64,125"
    expect(p.steps).toEqual([
      { key: 'BOOKING', label: 'Booking amount (25%)', amount: 21375, paid: 21375, remaining: 0, status: 'PAID', dueDate: null, note: 'Your booking is confirmed' },
      { key: 'BALANCE', label: 'Balance', amount: 64125, paid: 0, remaining: 64125, status: 'DUE', dueDate: null, note: 'Payment dates will be shared by your expert' },
    ]);
  });

  it('booking amount part-paid: next is only what confirms the booking', () => {
    const p = paymentPlan({ agreed: 85500, received: 5000, confirmationAmount: 21375, confirmationPercent: 25 });
    expect(p.next).toEqual({ amount: 16375, label: 'To confirm your booking', dueDate: null });
    expect(p.steps[0].status).toBe('PART_PAID');
    expect(p.steps[1]).toMatchObject({ paid: 0, status: 'DUE' });
  });

  it('money beyond the booking amount counts against the balance', () => {
    const p = paymentPlan({ agreed: 100000, received: 40000, confirmationAmount: 25000, confirmationPercent: 25 });
    expect(p.steps[1]).toMatchObject({ paid: 15000, remaining: 60000, status: 'PART_PAID' });
    expect(p.next).toBeNull();
  });

  it('fully paid', () => {
    const p = paymentPlan({ agreed: 100000, received: 100000, confirmationAmount: 25000, confirmationPercent: 25 });
    expect(p.due).toBe(0);
    expect(p.steps.map((s) => s.status)).toEqual(['PAID', 'PAID']);
    expect(p.steps[1].note).toBeNull();
  });

  it('no booking rule (older wedding): one Total step, no next amount', () => {
    const p = paymentPlan({ agreed: 50000, received: 10000, confirmationAmount: null, confirmationPercent: null });
    expect(p.steps).toHaveLength(1);
    expect(p.steps[0]).toMatchObject({ key: 'BALANCE', label: 'Total', paid: 10000, remaining: 40000 });
    expect(p.next).toBeNull();
  });

  it('nothing agreed yet', () => {
    const p = paymentPlan({ agreed: 0, received: 0, confirmationAmount: null, confirmationPercent: null });
    expect(p.steps).toEqual([]);
    expect(p.due).toBe(0);
  });
});

describe('paymentPlan with a payment schedule', () => {
  const schedule = [
    { label: 'Before the wedding', amount: 40000, dueDate: '2026-11-27' },
    { label: 'On the wedding day', amount: 24125, dueDate: '2026-11-30' },
  ];
  it('WED-2026-0002 with dates set: next is the first instalment and its date, not the whole balance', () => {
    const p = paymentPlan({ agreed: 85500, received: 21375, confirmationAmount: 21375, confirmationPercent: 25, instalments: schedule, today: '2026-11-22' });
    expect(p.scheduled).toBe(true);
    expect(p.steps.map((s) => [s.key, s.amount, s.paid, s.status, s.dueDate])).toEqual([
      ['BOOKING', 21375, 21375, 'PAID', null],
      ['INSTALMENT-1', 40000, 0, 'DUE', '2026-11-27'],
      ['INSTALMENT-2', 24125, 0, 'DUE', '2026-11-30'],
    ]);
    expect(p.next).toEqual({ amount: 40000, label: 'Before the wedding', dueDate: '2026-11-27' });
    // the steps reconcile with the agreement
    expect(p.steps.reduce((s, x) => s + x.amount, 0)).toBe(p.agreed);
    expect(p.steps.reduce((s, x) => s + x.remaining, 0)).toBe(p.due);
  });
  it('a part-paid instalment: next is only what is left of it', () => {
    const p = paymentPlan({ agreed: 85500, received: 31375, confirmationAmount: 21375, confirmationPercent: 25, instalments: schedule, today: '2026-11-22' });
    expect(p.next).toEqual({ amount: 30000, label: 'Before the wedding', dueDate: '2026-11-27' });
    expect(p.steps[1].status).toBe('PART_PAID');
  });
  it('booking amount not yet in: it still comes first', () => {
    const p = paymentPlan({ agreed: 85500, received: 5000, confirmationAmount: 21375, confirmationPercent: 25, instalments: schedule, today: '2026-11-22' });
    expect(p.next).toEqual({ amount: 16375, label: 'To confirm your booking', dueDate: null });
  });
  it('a missed date shows as overdue', () => {
    const p = paymentPlan({ agreed: 85500, received: 21375, confirmationAmount: 21375, confirmationPercent: 25, instalments: schedule, today: '2026-11-28' });
    expect(p.steps[1].status).toBe('OVERDUE');
  });
  it('everything paid: no next', () => {
    const p = paymentPlan({ agreed: 85500, received: 85500, confirmationAmount: 21375, confirmationPercent: 25, instalments: schedule, today: '2026-12-05' });
    expect(p.next).toBeNull();
    expect(p.steps.every((s) => s.status === 'PAID')).toBe(true);
  });
});
