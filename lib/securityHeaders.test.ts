/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { buildSecurityHeaders } from './securityHeaders';

function findHeader(headers: { key: string; value: string }[], key: string) {
  return headers.find((h) => h.key === key);
}

describe('buildSecurityHeaders', () => {
  test('always includes X-Content-Type-Options, X-Frame-Options, and Referrer-Policy', () => {
    const headers = buildSecurityHeaders('development');
    expect(findHeader(headers, 'X-Content-Type-Options')?.value).toBe('nosniff');
    expect(findHeader(headers, 'X-Frame-Options')?.value).toBe('DENY');
    expect(findHeader(headers, 'Referrer-Policy')?.value).toBe('strict-origin-when-cross-origin');
  });

  test('omits Strict-Transport-Security outside production', () => {
    expect(findHeader(buildSecurityHeaders('development'), 'Strict-Transport-Security')).toBeUndefined();
    expect(findHeader(buildSecurityHeaders(undefined), 'Strict-Transport-Security')).toBeUndefined();
    expect(findHeader(buildSecurityHeaders('test'), 'Strict-Transport-Security')).toBeUndefined();
  });

  test('includes Strict-Transport-Security in production', () => {
    const hsts = findHeader(buildSecurityHeaders('production'), 'Strict-Transport-Security');
    expect(hsts?.value).toBe('max-age=63072000; includeSubDomains; preload');
  });
});
