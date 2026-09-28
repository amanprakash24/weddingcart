/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';

// PUT/DELETE must mark the public ISR page /vendors/<slug> stale after a successful write, so an
// unpublished vendor stops being served from cache without a redeploy (seen 2026-09-28).
const revalidatePath = mock<(path: string) => void>(() => {});
const requireAdmin = mock(async () => true);
const vendor = { id: 'vendor-uuid-1', slug: 'the-grand-venue-patna', status: 'DRAFT', category: { slug: 'venue' } };
const getById = mock<(id: string) => Promise<typeof vendor | null>>(async () => vendor);
const update = mock(async () => vendor);
const del = mock(async () => vendor);

mock.module('next/cache', () => ({ revalidatePath }));
mock.module('@/lib/adminAuth', () => ({ requireAdmin }));
mock.module('@/services/vendor.service', () => ({ vendorService: { getById, update, delete: del } }));

const { PUT, DELETE } = await import('./route');

const ctx = { params: Promise.resolve({ id: 'vendor-uuid-1' }) };
const putRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/vendors/vendor-uuid-1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const deleteRequest = () => new NextRequest('http://localhost/api/vendors/vendor-uuid-1', { method: 'DELETE' });

beforeEach(() => {
  [revalidatePath, requireAdmin, getById, update, del].forEach((m) => m.mockClear());
  requireAdmin.mockImplementation(async () => true);
  getById.mockImplementation(async () => vendor);
  update.mockImplementation(async () => vendor);
  del.mockImplementation(async () => vendor);
  revalidatePath.mockImplementation(() => {});
});

describe('PUT /api/vendors/[id] — revalidates the public vendor page', () => {
  test('unpublishing (status → DRAFT) marks /vendors/<slug> stale — the public slug, not the UUID', async () => {
    const res = await PUT(putRequest({ status: 'DRAFT' }), ctx);
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/vendors/the-grand-venue-patna');
  });

  test('revalidates only after the write succeeded — a failed update revalidates nothing', async () => {
    update.mockImplementation(async () => {
      throw new Error('db down');
    });
    const res = await PUT(putRequest({ status: 'DRAFT' }), ctx);
    expect(res.status).toBe(500);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test('unauthorized callers change nothing and revalidate nothing', async () => {
    requireAdmin.mockImplementation(async () => false);
    const res = await PUT(putRequest({ status: 'DRAFT' }), ctx);
    expect(res.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test('a cache-invalidation failure never turns a saved change into an error', async () => {
    revalidatePath.mockImplementation(() => {
      throw new Error('cache unavailable');
    });
    const res = await PUT(putRequest({ status: 'DRAFT' }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});

describe('DELETE /api/vendors/[id] — revalidates the public vendor page', () => {
  test('looks the slug up BEFORE deleting, then marks /vendors/<slug> stale', async () => {
    const order: string[] = [];
    getById.mockImplementation(async () => (order.push('getById'), vendor));
    del.mockImplementation(async () => (order.push('delete'), vendor));
    const res = await DELETE(deleteRequest(), ctx);
    expect(res.status).toBe(200);
    expect(order).toEqual(['getById', 'delete']);
    expect(revalidatePath).toHaveBeenCalledWith('/vendors/the-grand-venue-patna');
  });

  test('a failed delete revalidates nothing', async () => {
    del.mockImplementation(async () => {
      throw new Error('restricted by foreign key');
    });
    const res = await DELETE(deleteRequest(), ctx);
    expect(res.status).toBe(500);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test('unauthorized callers delete nothing', async () => {
    requireAdmin.mockImplementation(async () => false);
    const res = await DELETE(deleteRequest(), ctx);
    expect(res.status).toBe(401);
    expect(del).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
