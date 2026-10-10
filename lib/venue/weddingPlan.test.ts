/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { validateFunctionForm, validateTaskForm } from './weddingPlan';

describe('a function on a business’s own wedding', () => {
  test('a named function: its day, time and place — a name typed for it is dropped', () => {
    expect(validateFunctionForm({ type: 'HALDI', label: 'ignored', date: '2026-12-08', startTime: '10:30', place: ' Main lawn ' })).toEqual({
      ok: true,
      value: { type: 'HALDI', label: null, date: new Date('2026-12-08T00:00:00.000Z'), startTime: '10:30', venueName: 'Main lawn' },
    });
  });

  test('time and place are optional', () => {
    expect(validateFunctionForm({ type: 'WEDDING', date: '2026-12-09' })).toMatchObject({ ok: true, value: { startTime: null, venueName: null } });
  });

  test('an "Other" function needs its name', () => {
    expect(validateFunctionForm({ type: 'OTHER', date: '2026-12-08' })).toEqual({ ok: false, errors: { label: 'Give this function a name' } });
    expect(validateFunctionForm({ type: 'OTHER', label: ' Tilak ', date: '2026-12-08' })).toMatchObject({ ok: true, value: { type: 'OTHER', label: 'Tilak' } });
  });

  test('what is wrong is said box by box', () => {
    expect(validateFunctionForm({ type: 'PARTY', date: '9 December', startTime: '6pm', place: 'x'.repeat(161) })).toEqual({
      ok: false,
      errors: { type: 'Choose the function', date: 'Pick the day', startTime: 'Time should look like 18:30', place: expect.any(String) },
    });
    expect(validateFunctionForm({ type: 'HALDI', date: '2026-02-31' })).toMatchObject({ ok: false, errors: { date: 'Pick the day' } });
  });
});

describe('a to-do on a business’s own wedding', () => {
  test('what, and by when (noon in India, so the day never slips)', () => {
    expect(validateTaskForm({ title: ' Confirm the generator ', dueOn: '2026-12-01' })).toEqual({ ok: true, value: { title: 'Confirm the generator', dueAt: new Date('2026-12-01T06:30:00.000Z') } });
    expect(validateTaskForm({ title: 'Call the florist' })).toEqual({ ok: true, value: { title: 'Call the florist', dueAt: null } });
  });

  test('an empty or over-long to-do, or a day that is not a day', () => {
    expect(validateTaskForm({ title: '  ' })).toEqual({ ok: false, errors: { title: 'Write what needs doing' } });
    expect(validateTaskForm({ title: 'x'.repeat(201), dueOn: 'soon' })).toEqual({ ok: false, errors: { title: expect.any(String), dueOn: 'Pick the day, or leave it empty' } });
  });
});
