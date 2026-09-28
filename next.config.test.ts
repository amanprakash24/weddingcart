/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
// The same matcher Next.js uses for `redirects()` sources, so these tests exercise real routing behaviour.
// @ts-expect-error — Next bundles this compiled copy without type declarations
import { match, compile } from 'next/dist/compiled/path-to-regexp';
import nextConfig, { NON_BIHAR_CITY_SLUGS } from './next.config';
import { BIHAR_CITIES } from './data/biharCities';

type Redirect = { source: string; destination: string; permanent: boolean };

async function resolve(path: string): Promise<{ to: string; permanent: boolean } | null> {
  const redirects = (await nextConfig.redirects!()) as Redirect[];
  for (const r of redirects) {
    if ('has' in r) continue; // host-based rule (bare domain → www) is not what these tests are about
    const m = match(r.source, { decode: decodeURIComponent })(path);
    if (m) return { to: compile(r.destination)(m.params as object), permanent: r.permanent };
  }
  return null;
}

describe('non-Bihar city pages redirect to Patna (temporary)', () => {
  test.each(NON_BIHAR_CITY_SLUGS)('/cities/%s → /cities/patna (307, not permanent)', async (city) => {
    expect(await resolve(`/cities/${city}`)).toEqual({ to: '/cities/patna', permanent: false });
  });

  test('category pages keep their category: /cities/delhi/venue → /cities/patna/venue', async () => {
    expect(await resolve('/cities/delhi/venue')).toEqual({ to: '/cities/patna/venue', permanent: false });
    expect(await resolve('/cities/goa/photo-video')).toEqual({ to: '/cities/patna/photo-video', permanent: false });
  });

  test('Patna and every Bihar city are NOT redirected — they are real, served pages', async () => {
    for (const city of ['patna', ...Object.keys(BIHAR_CITIES)]) {
      expect(await resolve(`/cities/${city}`)).toBeNull();
      expect(await resolve(`/cities/${city}/venue`)).toBeNull();
    }
  });

  test('a city merely starting with a redirected name is not caught (exact match only)', async () => {
    expect(await resolve('/cities/delhi-ncr')).toBeNull();
    expect(await resolve('/cities/goa-beach')).toBeNull();
  });

  test('no Bihar city is ever on the redirect list', () => {
    expect(NON_BIHAR_CITY_SLUGS.filter((c) => c === 'patna' || c in BIHAR_CITIES)).toEqual([]);
  });
});
