import { describe, expect, it } from 'bun:test';
import { paymentPlan } from './paymentPlan';

describe('paymentPlan', () => {
  it('WED-2026-0002 shape: booking amount paid in two parts, balance has no fixed next amount', () => {
    const p = paymentPlan({ agreed: 85500, received: 21375, confirmationAmount: 21375, confirmationPercent: 25 });
    expect(p.due).toBe(64125);
    expect(p.next).toBeNull(); // never "Next: ₹64,125"
    expect(p.steps).toEqual([
      { key: 'BOOKING', label: 'Booking amount (25%)', amount: 21375, paid: 21375, remaining: 0, status: 'PAID', note: 'Your booking is confirmed' },
      { key: 'BALANCE', label: 'Balance', amount: 64125, paid: 0, remaining: 64125, status: 'DUE', note: 'Payment dates will be shared by your expert' },
    ]);
  });

  it('booking amount part-paid: next is only what confirms the booking', () => {
    const p = paymentPlan({ agreed: 85500, received: 5000, confirmationAmount: 21375, confirmationPercent: 25 });
    expect(p.next).toEqual({ amount: 16375, label: 'To confirm your booking' });
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
