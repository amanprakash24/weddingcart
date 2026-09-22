/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';

function makeRepoMock({ existing = [] as { id: string; status: string; lastContactedAt: Date | null }[] } = {}) {
  const byId = new Map(existing.map((e) => [e.id, e]));
  const findByIdMock = mock(async (id: string) => byId.get(id) ?? null);
  const updateMock = mock(async (id: string, data: Record<string, unknown>) => ({ id, ...byId.get(id), ...data }));
  const findManyMock = mock(async () => ({ data: [], total: 0 }));
  const createManyMock = mock(async (rows: unknown[]) => ({ count: (rows as unknown[]).length }));
  return { findByIdMock, updateMock, findManyMock, createManyMock };
}

async function loadServiceWith(repoMock: ReturnType<typeof makeRepoMock>, prismaMock?: unknown) {
  mock.module('@/repositories/vendorProspect.repository', () => ({
    vendorProspectRepository: {
      findById: repoMock.findByIdMock,
      update: repoMock.updateMock,
      findMany: repoMock.findManyMock,
      createMany: repoMock.createManyMock,
    },
  }));
  mock.module('@/lib/prisma', () => ({
    prisma: prismaMock ?? { vendor: { findMany: mock(async () => []) }, vendorProspect: { findMany: mock(async () => []) } },
  }));
  const { vendorProspectService } = await import('./vendorProspect.service');
  return vendorProspectService;
}

describe('vendorProspectService.updateStatus', () => {
  test('returns null for an unknown id', async () => {
    const repo = makeRepoMock();
    const service = await loadServiceWith(repo);
    expect(await service.updateStatus('missing', 'CONTACTED')).toBeNull();
  });

  test('stamps lastContactedAt when moving to a non-NEW status', async () => {
    const repo = makeRepoMock({ existing: [{ id: 'p1', status: 'NEW', lastContactedAt: null }] });
    const service = await loadServiceWith(repo);
    const result = await service.updateStatus('p1', 'CONTACTED');
    expect(result).not.toBeNull();
    expect(repo.updateMock).toHaveBeenCalledTimes(1);
    const [, data] = repo.updateMock.mock.calls[0] as [string, { lastContactedAt: Date }];
    expect(data.lastContactedAt).toBeInstanceOf(Date);
  });

  test('does not stamp lastContactedAt when set back to NEW', async () => {
    const repo = makeRepoMock({ existing: [{ id: 'p1', status: 'CONTACTED', lastContactedAt: null }] });
    const service = await loadServiceWith(repo);
    await service.updateStatus('p1', 'NEW');
    const [, data] = repo.updateMock.mock.calls[0] as [string, { lastContactedAt: Date | null }];
    expect(data.lastContactedAt).toBeNull();
  });

  test('passes notes through when provided', async () => {
    const repo = makeRepoMock({ existing: [{ id: 'p1', status: 'NEW', lastContactedAt: null }] });
    const service = await loadServiceWith(repo);
    await service.updateStatus('p1', 'INTERESTED', 'Called, wants a call back next week');
    const [, data] = repo.updateMock.mock.calls[0] as [string, { notes: string }];
    expect(data.notes).toBe('Called, wants a call back next week');
  });
});

describe('vendorProspectService.importRows', () => {
  const row = (overrides: Partial<Parameters<typeof mkRow>[0]> = {}) => mkRow(overrides);
  function mkRow(overrides: Record<string, unknown> = {}) {
    return { name: 'Dream Banquet Hall', city: 'Patna', phone: '+919999900000', source: 'weddingz.in scrape', ...overrides };
  }

  test('imports a fresh row as NEW when nothing matches', async () => {
    const repo = makeRepoMock();
    const service = await loadServiceWith(repo, {
      vendor: { findMany: mock(async () => []) },
      vendorProspect: { findMany: mock(async () => []) },
    });
    const result = await service.importRows([row()]);
    expect(result).toEqual({ created: 1, skipped: 0 });
    const [rows] = repo.createManyMock.mock.calls[0] as [{ status: string }[]];
    expect(rows[0].status).toBe('NEW');
  });

  test('marks a row ALREADY_LISTED when its phone matches an existing Vendor', async () => {
    const repo = makeRepoMock();
    const service = await loadServiceWith(repo, {
      vendor: { findMany: mock(async () => [{ ownerPhone: '+919999900000' }]) },
      vendorProspect: { findMany: mock(async () => []) },
    });
    await service.importRows([row()]);
    const [rows] = repo.createManyMock.mock.calls[0] as [{ status: string }[]];
    expect(rows[0].status).toBe('ALREADY_LISTED');
  });

  test('skips a row whose (name, phone) pair already exists as a prospect', async () => {
    const repo = makeRepoMock();
    const service = await loadServiceWith(repo, {
      vendor: { findMany: mock(async () => []) },
      vendorProspect: { findMany: mock(async () => [{ name: 'Dream Banquet Hall', phone: '+919999900000' }]) },
    });
    const result = await service.importRows([row()]);
    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(repo.createManyMock).not.toHaveBeenCalled();
  });

  test('imports two rows that share a phone but have different names', async () => {
    const repo = makeRepoMock();
    const service = await loadServiceWith(repo, {
      vendor: { findMany: mock(async () => []) },
      vendorProspect: { findMany: mock(async () => []) },
    });
    const result = await service.importRows([row({ name: 'Hall A' }), row({ name: 'Hall B' })]);
    expect(result).toEqual({ created: 2, skipped: 0 });
  });
});
