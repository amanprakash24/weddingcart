/// <reference types="bun-types" />
import { describe, test, expect, afterEach } from 'bun:test';
import { adminSend, failureMessage, SEND_MESSAGES } from './adminSend';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
function reply(status: number, body: unknown) {
  globalThis.fetch = (async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe('failureMessage', () => {
  test("the server's own sentence wins", () => {
    expect(failureMessage(400, { error: 'Some details are missing' })).toBe('Some details are missing');
    expect(failureMessage(400, { message: 'Invalid phone number' })).toBe('Invalid phone number');
  });
  test('bare Unauthorized / Forbidden become something a person can act on', () => {
    expect(failureMessage(401, { error: 'Unauthorized' })).toBe(SEND_MESSAGES.signedOut);
    expect(failureMessage(403, { error: 'Forbidden' })).toBe(SEND_MESSAGES.notAllowed);
    expect(failureMessage(403, { error: 'Only the founder can delete vendors.' })).toBe('Only the founder can delete vendors.');
  });
  test('no words from the server: a plain fallback', () => {
    expect(failureMessage(500, null)).toBe(SEND_MESSAGES.failed);
    expect(failureMessage(502, { error: '  ' })).toBe(SEND_MESSAGES.failed);
  });
});

describe('adminSend', () => {
  test('a success reply is ok and carries the data', async () => {
    reply(201, { success: true, data: { id: 'x' } });
    expect(await adminSend('/api/x', 'POST', { a: 1 })).toEqual({ ok: true, data: { success: true, data: { id: 'x' } } });
  });
  test('a 200 that says success:false is still a failure', async () => {
    reply(200, { success: false, error: 'Not saved' });
    expect(await adminSend('/api/x', 'PUT', {})).toEqual({ ok: false, message: 'Not saved' });
  });
  test('a 500 with an HTML page is a failure with the plain fallback', async () => {
    reply(500, '<html>oops</html>');
    expect(await adminSend('/api/x', 'DELETE')).toEqual({ ok: false, message: SEND_MESSAGES.failed });
  });
  test('no network: says nothing was saved', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await adminSend('/api/x', 'POST', {})).toEqual({ ok: false, message: SEND_MESSAGES.offline });
  });
  test('a DELETE with an empty 204 reply is ok', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    expect((await adminSend('/api/x', 'DELETE')).ok).toBe(true);
  });
});
