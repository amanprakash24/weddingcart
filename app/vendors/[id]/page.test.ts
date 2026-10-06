/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';

// Locks in the rule the route-level revalidation relies on: only a PUBLISHED vendor renders; anything
// else is a 404 with noindex metadata. If this check were weakened, revalidating the page would just
// re-render the unpublished vendor.
const rows: Record<string, { status: string }> = {};
const findBySlug = mock(async (slug: string) => {
  const row = rows[slug];
  if (!row) return null;
  return {
    slug, status: row.status, name: 'The Grand Venue', city: 'Patna', address: '', ownerPhone: '',
    categoryId: 'cat-1', description: 'A venue.', priceMin: 1000, priceMax: 2000, rating: 4.5, reviewCount: 0,
    image: '', faqs: [],
  };
});
mock.module('@/repositories/vendor.repository', () => ({ vendorRepository: { findBySlug, findMany: mock(async () => ({ data: [] })) } }));
mock.module('@/repositories/category.repository', () => ({ categoryRepository: { findById: mock(async () => ({ slug: 'venue' })) } }));
mock.module('@/components/VendorDetailClient', () => ({ default: () => null }));
mock.module('@/components/JsonLd', () => ({ JsonLd: () => null }));
// Roadmap 1.4: the page reads published couple reviews through review.service. With this empty stub that read fails — and the page
// must still render (it falls back to no reviews).
mock.module('@/lib/prisma', () => ({ prisma: {} }));

const page = await import('./page');
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('/vendors/[id] — only PUBLISHED vendors are public', () => {
  test('PUBLISHED: normal metadata, indexable', async () => {
    rows['published-venue'] = { status: 'PUBLISHED' };
    const meta = await page.generateMetadata(params('published-venue'));
    expect(String(meta.title)).toContain('The Grand Venue');
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  test.each(['DRAFT', 'PENDING_VERIFICATION'])('%s: "Not Found" metadata with noindex, and the page 404s', async (status) => {
    rows['hidden-venue'] = { status };
    const meta = await page.generateMetadata(params('hidden-venue'));
    expect(meta.title).toBe('Not Found');
    expect(meta.robots).toEqual({ index: false, follow: false });
    // notFound() throws Next's HTTP-error signal (digest NEXT_HTTP_ERROR_FALLBACK;404).
    const err = await page.default(params('hidden-venue')).then(() => null, (e: unknown) => e as { digest?: string });
    expect(err?.digest).toContain('404');
  });

  test('missing vendor: same 404 + noindex', async () => {
    const meta = await page.generateMetadata(params('does-not-exist'));
    expect(meta.robots).toEqual({ index: false, follow: false });
    const err = await page.default(params('does-not-exist')).then(() => null, (e: unknown) => e as { digest?: string });
    expect(err?.digest).toContain('404');
  });
});

describe('/vendors/[id] — couple reviews (Roadmap 1.4)', () => {
  test('a published vendor still renders when the reviews cannot be read', async () => {
    rows['published-venue'] = { status: 'PUBLISHED' };
    const el = (await page.default(params('published-venue'))) as { props: { children: unknown[] } };
    expect(el).toBeTruthy();
    const json = JSON.stringify(el, (_k, v) => (typeof v === 'function' ? undefined : v));
    expect(json).toContain('"verified":null');
  });
});
