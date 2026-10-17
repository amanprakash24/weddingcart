import { describe, expect, test } from 'bun:test';
import {
  checkEnquiryForm,
  DATE_REQUIRED_MESSAGE,
  ENQUIRY_MESSAGES,
  isEventDate,
  PHONE_INVALID_MESSAGE,
  submitEnquiry,
} from './publicEnquiry';

const reply = (status: number, body: unknown) =>
  (async () => new Response(body === undefined ? 'not json' : JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('checkEnquiryForm', () => {
  test('an empty date is refused with the date message', () => {
    expect(checkEnquiryForm({ phone: '9876543210', eventDate: '' })).toBe(DATE_REQUIRED_MESSAGE);
    expect(checkEnquiryForm({ phone: '9876543210', eventDate: '   ' })).toBe(DATE_REQUIRED_MESSAGE);
  });
  test('a date that is not a real calendar day is refused', () => {
    expect(checkEnquiryForm({ phone: '9876543210', eventDate: '2026-02-30' })).toBe(DATE_REQUIRED_MESSAGE);
    expect(checkEnquiryForm({ phone: '9876543210', eventDate: '20 October 20202' })).toBe(DATE_REQUIRED_MESSAGE);
  });
  test('a bad phone is reported first', () => {
    expect(checkEnquiryForm({ phone: '12345', eventDate: '' })).toBe(PHONE_INVALID_MESSAGE);
  });
  test('a full form passes', () => {
    expect(checkEnquiryForm({ phone: '98765 43210', eventDate: '2026-12-05' })).toBeNull();
    expect(isEventDate('2028-02-29')).toBe(true);
  });
});

describe('submitEnquiry', () => {
  test('success only when the server answers 201 with success: true', async () => {
    expect(await submitEnquiry({}, reply(201, { success: true, data: {} }))).toEqual({ ok: true });
  });
  test('a 2xx without success: true is not treated as sent', async () => {
    expect((await submitEnquiry({}, reply(200, { success: false }))).ok).toBe(false);
    expect((await submitEnquiry({}, reply(200, undefined))).ok).toBe(false);
  });
  test('a refused enquiry (400) reports the invalid message', async () => {
    expect(await submitEnquiry({}, reply(400, { success: false, error: 'x' }))).toEqual({ ok: false, message: ENQUIRY_MESSAGES.invalid });
  });
  test('rate limiting (429) has its own message', async () => {
    expect(await submitEnquiry({}, reply(429, { success: false }))).toEqual({ ok: false, message: ENQUIRY_MESSAGES.rateLimited });
  });
  test('a server error (500, non-JSON) reports the server message', async () => {
    expect(await submitEnquiry({}, reply(500, undefined))).toEqual({ ok: false, message: ENQUIRY_MESSAGES.server });
  });
  test('a network failure reports the network message', async () => {
    const down = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    expect(await submitEnquiry({}, down)).toEqual({ ok: false, message: ENQUIRY_MESSAGES.network });
  });
  test('sends JSON to /api/enquiries', async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const spy = (async (url: string, init?: RequestInit) => { seen = { url, init }; return new Response('{"success":true}', { status: 201 }); }) as unknown as typeof fetch;
    await submitEnquiry({ eventDate: '2026-12-05' }, spy);
    expect(seen!.url).toBe('/api/enquiries');
    expect(seen!.init?.method).toBe('POST');
    expect(JSON.parse(String(seen!.init?.body))).toEqual({ eventDate: '2026-12-05' });
  });
});
