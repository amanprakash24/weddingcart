/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { NextRequest } from 'next/server';

function getRequest(url: string) {
  return new NextRequest(url);
}

async function loadRouteWith({
  isAdmin = true,
  list = mock(async () => ({ data: [], total: 0 })),
}: { isAdmin?: boolean; list?: ReturnType<typeof mock> } = {}) {
  mock.module('@/lib/adminAuth', () => ({ requireAdmin: mock(async () => isAdmin) }));
  mock.module('@/services/vendorProspect.service', () => ({ vendorProspectService: { list } }));
  const route = await import('./route');
  return { GET: route.GET, list };
}

describe('GET /api/vendor-prospects', () => {
  test('rejects an unauthenticated caller', async () => {
    const { GET } = await loadRouteWith({ isAdmin: false });
    const res = await GET(getRequest('http://localhost/api/vendor-prospects'));
    expect(res.status).toBe(401);
  });

  test('passes status/city/search/pagination through to the service', async () => {
    const { GET, list } = await loadRouteWith();
    await GET(getRequest('http://localhost/api/vendor-prospects?status=NEW&city=Patna&search=Dream&page=2&limit=10'));
    expect(list).toHaveBeenCalledTimes(1);
    const [args] = list.mock.calls[0] as [{ status: string; city: string; search: string; skip: number; take: number }];
    expect(args).toEqual({ status: 'NEW', city: 'Patna', search: 'Dream', skip: 10, take: 10 });
  });

  test('ignores an invalid status value rather than erroring', async () => {
    const { GET, list } = await loadRouteWith();
    await GET(getRequest('http://localhost/api/vendor-prospects?status=NOT_A_REAL_STATUS'));
    const [args] = list.mock.calls[0] as [{ status: string | undefined }];
    expect(args.status).toBeUndefined();
  });

  test('caps limit at 500', async () => {
    const { GET, list } = await loadRouteWith();
    await GET(getRequest('http://localhost/api/vendor-prospects?limit=9999'));
    const [args] = list.mock.calls[0] as [{ take: number }];
    expect(args.take).toBe(500);
  });
});
