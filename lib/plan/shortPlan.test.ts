/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { consultationCreateSchema } from '@/app/api/consultations/schema';
import { checkPlanForm, planPayload, planPhoneDigits, BUDGET_QUERY_MAP, BUDGET_OPTIONS, type PlanFields } from './shortPlan';

const TODAY = '2026-10-25';
const good: PlanFields = { name: ' Riya Kumari ', phone: '+91 98765-43210', weddingDate: '2027-02-14', guests: '300', budgetRange: '10-20L', services: ['venue', 'catering'] };

describe('the short /plan form', () => {
  test('four details are enough to send', () => {
    expect(checkPlanForm(good, TODAY)).toEqual({});
    expect(checkPlanForm({ ...good, budgetRange: '', services: [] }, TODAY)).toEqual({});
  });

  test('each missing or wrong detail gets its own message', () => {
    const p = checkPlanForm({ name: ' ', phone: '12345', weddingDate: '', guests: '0', budgetRange: '', services: [] }, TODAY);
    expect(Object.keys(p).sort()).toEqual(['guests', 'name', 'phone', 'weddingDate']);
    expect(checkPlanForm({ ...good, weddingDate: '2026-10-24' }, TODAY).weddingDate).toContain('today onwards');
    expect(checkPlanForm({ ...good, guests: '2.5' }, TODAY).guests).toBeDefined();
  });

  test('mobile numbers with +91, 0, spaces or dashes; not landline-like ones', () => {
    expect(planPhoneDigits('+91 98765-43210')).toBe('9876543210');
    expect(planPhoneDigits('09876543210')).toBe('9876543210');
    expect(planPhoneDigits('1234567890')).toBeNull();
  });

  test('what it sends passes the server\'s own validation (app/api/consultations/schema.ts)', () => {
    const body = planPayload(good, [], 0);
    expect(consultationCreateSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ name: 'Riya Kumari', phone: '9876543210', guestCount: 300, days: 1, weddingDate: '2027-02-14', budgetRange: '10-20L', services: ['venue', 'catering'] });
    expect(body).not.toHaveProperty('cartItems');
    expect(planPayload({ ...good, budgetRange: '' }, [], 0)).not.toHaveProperty('budgetRange');
  });

  test('cart services go with it', () => {
    const body = planPayload(good, [{ id: 'v1' }], 125000.4);
    expect(body).toMatchObject({ cartItems: [{ id: 'v1' }], totalBudget: 125000 });
    expect(consultationCreateSchema.safeParse(body).success).toBe(true);
  });

  test('homepage budget links land on a real option', () => {
    const ids: string[] = BUDGET_OPTIONS.map((b) => b.id);
    for (const v of Object.values(BUDGET_QUERY_MAP)) expect(ids).toContain(v);
  });
});
