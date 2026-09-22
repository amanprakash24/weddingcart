/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { NextRequest } from 'next/server';

function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/vendor-prospects/p1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function loadRouteWith({
  isAdmin = true,
  updateStatus = mock(async (id: string, status: string, notes?: string) => ({ id, status, notes })),
}: { isAdmin?: boolean; updateStatus?: ReturnType<typeof mock> } = {}) {
  mock.module('@/lib/adminAuth', () => ({ requireAdmin: mock(async () => isAdmin) }));
  mock.module('@/services/vendorProspect.service', () => ({ vendorProspectService: { updateStatus } }));
  const route = await import('./route');
  return { PATCH: route.PATCH, updateStatus };
}

describe('PATCH /api/vendor-prospects/[id]', () => {
  test('rejects an unauthenticated caller', async () => {
    const { PATCH } = await loadRouteWith({ isAdmin: false });
    const res = await PATCH(patchRequest({ status: 'CONTACTED' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(401);
  });

  test('rejects an invalid status', async () => {
    const { PATCH } = await loadRouteWith();
    const res = await PATCH(patchRequest({ status: 'NOT_REAL' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
  });

  test('returns 404 when the prospect does not exist', async () => {
    const { PATCH } = await loadRouteWith({ updateStatus: mock(async () => null) });
    const res = await PATCH(patchRequest({ status: 'CONTACTED' }), { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);
  });

  test('updates status and notes on success', async () => {
    const { PATCH, updateStatus } = await loadRouteWith();
    const res = await PATCH(patchRequest({ status: 'INTERESTED', notes: 'called, interested' }), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    expect(updateStatus).toHaveBeenCalledWith('p1', 'INTERESTED', 'called, interested');
  });
});
