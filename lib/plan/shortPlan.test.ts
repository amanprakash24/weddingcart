/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { consultationCreateSchema } from '@/app/api/consultations/schema';
import type { PlanFormData } from '@/lib/planPreview';
import { BUDGET_OPTIONS, BUDGET_QUERY_MAP, MAIN_SERVICES, MORE_SERVICES, checkPlanForm, extraAnswers, planPayload, planPhoneDigits } from './shortPlan';

const TODAY = '2026-10-25';
const quickOnly: PlanFormData = {
  name: ' Riya Kumari ', phone: '+91 98765-43210', email: '', city: 'Patna', weddingDate: '2027-02-14', days: 1,
  guestCount: 300, foodPreference: '', weddingStyle: '', budgetRange: '', eventType: 'wedding',
  services: [], meals: {}, venueType: '', consultationDate: '', preferredTime: '', message: '',
};
const everything: PlanFormData = {
  ...quickOnly, email: 'riya@example.com', days: 3, foodPreference: 'both', weddingStyle: 'royal', budgetRange: '10-20L',
  services: ['venue', 'catering', 'security'], meals: { 1: ['Dinner', 'Lunch'], 3: ['Breakfast'], 5: ['Dinner'] },
  venueType: 'garden', consultationDate: '2026-11-02', preferredTime: '17:30', message: 'Mandap near the lawn please',
};

describe('the /plan form — quick details', () => {
  test('the four details are enough to send; everything else is optional', () => {
    expect(checkPlanForm(quickOnly, TODAY)).toEqual({});
  });

  test('each missing or wrong detail gets its own message', () => {
    const p = checkPlanForm({ name: ' ', phone: '12345', weddingDate: '', guestCount: 0 }, TODAY);
    expect(Object.keys(p).sort()).toEqual(['guestCount', 'name', 'phone', 'weddingDate']);
    expect(checkPlanForm({ ...quickOnly, weddingDate: '2026-10-24' }, TODAY).weddingDate).toContain('today onwards');
    expect(checkPlanForm({ ...quickOnly, guestCount: 2.5 }, TODAY).guestCount).toBeDefined();
  });

  test('mobile numbers with +91, 0, spaces or dashes', () => {
    expect(planPhoneDigits('+91 98765-43210')).toBe('9876543210');
    expect(planPhoneDigits('09876543210')).toBe('9876543210');
    expect(planPhoneDigits('1234567890')).toBeNull();
  });
});

describe('every answer reaches the CRM', () => {
  test('quick details only: valid for the server', () => {
    const body = planPayload(quickOnly, '', [], 0);
    expect(consultationCreateSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ name: 'Riya Kumari', phone: '9876543210', guestCount: 300, days: 1, city: 'Patna', eventType: 'wedding' });
    expect(body).not.toHaveProperty('message');
  });

  test('everything filled: the server keeps its fields, and the rest is in the message', () => {
    const body = planPayload(everything, 'outdoor', [{ id: 'v1' }], 125000.4);
    const parsed = consultationCreateSchema.parse(body);
    expect(parsed).toMatchObject({ email: 'riya@example.com', days: 3, foodPreference: 'both', venueType: 'garden', preferredTime: '17:30', budgetRange: '10-20L', totalBudget: 125000, services: ['venue', 'catering', 'security'] });
    // style, setting, meals and the call date have no column — they must survive in the message the server keeps
    expect(parsed.message).toContain('Mandap near the lawn please');
    expect(parsed.message).toContain('Style: Royal');
    expect(parsed.message).toContain('Setting: Outdoor');
    expect(parsed.message).toContain('Meals: Day 1 Lunch, Dinner; Day 3 Breakfast');
    expect(parsed.message).not.toContain('Day 5'); // only days that are part of the event
    expect(parsed.message).toContain('Call on: 2026-11-02 at 17:30');
  });

  test('no extras, no extra lines', () => {
    expect(extraAnswers(quickOnly, '')).toEqual([]);
  });
});

describe('options', () => {
  test('all 21 services of the old wizard are still offered', () => {
    expect(MAIN_SERVICES.length + MORE_SERVICES.length).toBe(21);
  });
  test('homepage budget links land on a real option', () => {
    const ids: string[] = BUDGET_OPTIONS.map((b) => b.id);
    for (const v of Object.values(BUDGET_QUERY_MAP)) expect(ids).toContain(v);
  });
});
