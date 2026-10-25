/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { cleanDetail, cleanLocation, cleanMessage, cleanSiteError, fingerprintOf, isNoise, routeFromStack, shortBrowser } from './normalize';

describe('cleanLocation — no private data in addresses', () => {
  test('a private proposal link token, ids and the query string are removed', () => {
    expect(cleanLocation('/proposal/q7Kd93jfLx02mZ9aa?phone=9876543210')).toBe('/proposal/:id');
    expect(cleanLocation('/api/quotations/3f2b1c9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/create-booking')).toBe('/api/quotations/:id/create-booking');
    expect(cleanLocation('https://www.shaadishopping.com/vendor/weddings/9876543210#top')).toBe('/vendor/weddings/:id');
  });
  test('ordinary readable paths stay as they are', () => {
    expect(cleanLocation('/cities/patna/venue')).toBe('/cities/patna/venue');
    expect(cleanLocation('/blog/court-marriage-registration-patna-bihar')).toBe('/blog/court-marriage-registration-patna-bihar');
    expect(cleanLocation('')).toBe('unknown');
  });
});

describe('cleanMessage / cleanDetail', () => {
  test('one short line without ids, long numbers or query strings', () => {
    expect(cleanMessage('Lead 3f2b1c9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f for\n 9876543210 failed')).toBe('Lead :id for :n failed');
    expect(cleanMessage('GET https://x.com/a?token=abc failed')).toBe('GET https://x.com/a failed');
    expect(cleanMessage('x'.repeat(500))).toHaveLength(300);
    expect(cleanMessage('')).toBe('Unknown error');
  });
  test('stack: first 8 lines, no query strings', () => {
    const stack = ['Error: boom', ...Array.from({ length: 20 }, (_, i) => `    at f${i} (https://www.shaadishopping.com/_next/x.js?dpl=abc:1:${i})`)].join('\n');
    const out = cleanDetail(stack)!;
    expect(out.split('\n')).toHaveLength(8);
    expect(out).not.toContain('dpl=abc');
    expect(cleanDetail(undefined)).toBeNull();
  });
});

describe('noise is ignored', () => {
  test('extensions, lost connections, aborted requests, Next signals, stale tabs', () => {
    for (const message of ['ResizeObserver loop limit exceeded', 'Script error.', 'TypeError: Failed to fetch', 'Load failed', 'AbortError: The user aborted a request.', 'NEXT_REDIRECT', 'ChunkLoadError: Loading chunk 123 failed.']) {
      expect(isNoise({ message })).toBe(true);
    }
    expect(isNoise({ message: 'TypeError: x is undefined', detail: 'at chrome-extension://abc/content.js:1:1' })).toBe(true);
  });
  test('a real error is kept', () => {
    expect(isNoise({ message: "TypeError: Cannot read properties of undefined (reading 'price')" })).toBe(false);
    expect(cleanSiteError({ source: 'BROWSER', message: 'Failed to fetch', location: '/' })).toBeNull();
  });
});

describe('grouping', () => {
  test('the same problem on two different proposal links is one row', () => {
    const a = cleanSiteError({ source: 'BROWSER', message: 'x is undefined', location: '/proposal/AAAA1111bbbb2222' })!;
    const b = cleanSiteError({ source: 'BROWSER', message: 'x is undefined', location: '/proposal/ZZZZ9999yyyy8888?a=1' })!;
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.fingerprint).toHaveLength(32);
  });
  test('a different place, message or source is a different row', () => {
    const base = fingerprintOf('SERVER', 'boom', '/a');
    expect(fingerprintOf('SERVER', 'boom', '/b')).not.toBe(base);
    expect(fingerprintOf('SERVER', 'bang', '/a')).not.toBe(base);
    expect(fingerprintOf('BROWSER', 'boom', '/a')).not.toBe(base);
  });
  test('browser name only for browser errors', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
    expect(cleanSiteError({ source: 'BROWSER', message: 'm', location: '/', browser: ua })!.browser).toBe('Chrome · Android');
    expect(cleanSiteError({ source: 'SERVER', message: 'm', location: '/', browser: ua })!.browser).toBeNull();
  });
});

describe('shortBrowser / routeFromStack', () => {
  test('common browsers', () => {
    expect(shortBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe('Safari · iPhone');
    expect(shortBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Edge · Windows');
    expect(shortBrowser(null)).toBeNull();
  });
  test('the API route from a built stack trace', () => {
    expect(routeFromStack('Error: x\n    at handlePOST (/var/task/.next/server/app/api/leads/route.js:1:200)')).toBe('app/api/leads/route');
    expect(routeFromStack('Error: x\n    at f (C:\\w\\app\\api\\quotations\\[id]\\route.ts:3:4)')).toBe('app/api/quotations/[id]/route');
    expect(routeFromStack('Error: x\n    at f (node:internal/x)')).toBeNull();
  });
});
