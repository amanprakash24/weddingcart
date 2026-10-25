/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { CALLBACK_LEAD_FAILED, callbackLeadDigits, submitCallbackLead } from './submitCallbackLead';

const reply = (status: number, body: unknown) =>
  mock(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('submitCallbackLead', () => {
  test('success only when the server saved it (201 + success)', async () => {
    const f = reply(201, { success: true });
    expect(await submitCallbackLead('9876543210', true, f)).toEqual({ ok: true });
    const [url, init] = (f as unknown as ReturnType<typeof mock>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/leads');
    expect(JSON.parse(String(init.body))).toEqual({ phone: '+919876543210', whatsapp: true });
  });

  test('a refused or failed save is reported, never shown as "thank you"', async () => {
    expect(await submitCallbackLead('9876543210', false, reply(400, { success: false, error: 'Valid phone number required' }))).toEqual({ ok: false, error: CALLBACK_LEAD_FAILED });
    expect(await submitCallbackLead('9876543210', false, reply(500, { success: false }))).toEqual({ ok: false, error: CALLBACK_LEAD_FAILED });
    expect(await submitCallbackLead('9876543210', false, reply(502, '<html>Bad gateway</html>'))).toEqual({ ok: false, error: CALLBACK_LEAD_FAILED });
    expect(await submitCallbackLead('9876543210', false, reply(200, { success: false }))).toEqual({ ok: false, error: CALLBACK_LEAD_FAILED });
  });

  test('no network is reported too', async () => {
    const offline = mock(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    expect(await submitCallbackLead('9876543210', true, offline)).toEqual({ ok: false, error: CALLBACK_LEAD_FAILED });
  });

  test('the failure message gives our phone number', () => {
    expect(CALLBACK_LEAD_FAILED).toContain('76460');
  });
});

describe('callbackLeadDigits', () => {
  test('a 10-digit Indian mobile, with or without +91', () => {
    expect(callbackLeadDigits('9876543210')).toBe('9876543210');
    expect(callbackLeadDigits('+91 98765 43210')).toBe('9876543210');
    expect(callbackLeadDigits('919876543210')).toBe('9876543210');
  });
  test('anything else is refused before sending', () => {
    expect(callbackLeadDigits('12345')).toBeNull();
    expect(callbackLeadDigits('1234567890')).toBeNull();
    expect(callbackLeadDigits('')).toBeNull();
  });
});
