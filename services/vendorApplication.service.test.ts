/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';

// Mocks at the repository boundary (not @/lib/prisma directly) — matching services/stats.service.test.ts's
// own approach for this exact repository. Bun's mock.module registrations are global across the whole test
// run, not scoped per file; stats.service.test.ts also mocks '@/repositories/vendorApplication.repository'
// with a narrower shape, so re-registering the full mock here, right before each dynamic import, is what
// keeps this file correct regardless of test run order — not a workaround, the same pattern already in use.
// Scoped to the new capability-copy-on-approval logic (provisionVendorCapabilities) added to
// vendorApplicationService.updateStatus, not a full re-test of the pre-existing account-provisioning flow.
function fakeApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    status: 'NEW',
    vendorId: null,
    ownerPhone: '9876543210',
    categoryId: 'cat-1',
    category: { slug: 'photography', name: 'Photography' },
    businessName: 'Royal Wedding Photography',
    capabilities: [] as string[],
    ...overrides,
  };
}

function makeMocks(application: ReturnType<typeof fakeApplication>) {
  const vendorCapabilityCreateMany = mock(async (args: { data: unknown[] }) => ({ count: args.data.length }));
  const userFindUnique = mock(async () => null);
  const userCreate = mock(async () => ({ id: 'user-1' }));
  const userRoleUpsert = mock(async () => ({}));
  const vendorProfileCreate = mock(async () => ({}));

  const tx = {
    user: { findUnique: userFindUnique, create: userCreate },
    userRole: { upsert: userRoleUpsert },
    vendorProfile: { create: vendorProfileCreate },
    vendorCapability: { createMany: vendorCapabilityCreateMany },
  };

  const prismaMock = { $transaction: mock(async (fn: (transactionClient: typeof tx) => Promise<unknown>) => fn(tx)) };

  const vendorApplicationRepository = {
    findById: mock(async () => application),
    update: mock(async (id: string, data: Record<string, unknown>) => ({ ...application, ...data })),
  };
  const vendorRepository = { create: mock(async () => ({ id: 'vendor-1' })) };

  return { prismaMock, vendorApplicationRepository, vendorRepository, vendorCapabilityCreateMany, vendorCreate: vendorRepository.create };
}

async function loadServiceWith(mocks: ReturnType<typeof makeMocks>) {
  mock.module('@/lib/prisma', () => ({ prisma: mocks.prismaMock }));
  mock.module('@/repositories/vendorApplication.repository', () => ({ vendorApplicationRepository: mocks.vendorApplicationRepository }));
  mock.module('@/repositories/vendor.repository', () => ({ vendorRepository: mocks.vendorRepository }));
  const { vendorApplicationService } = await import('./vendorApplication.service');
  return vendorApplicationService;
}

describe('vendorApplicationService.updateStatus — capability copy on approval', () => {
  test('approving an application with selected capabilities creates the matching VendorCapability rows', async () => {
    const application = fakeApplication({ capabilities: ['HALDI', 'SANGEET'] });
    const mocks = makeMocks(application);
    const service = await loadServiceWith(mocks);

    await service.updateStatus('app-1', 'APPROVED');

    expect(mocks.vendorCapabilityCreateMany).toHaveBeenCalledTimes(1);
    const [args] = mocks.vendorCapabilityCreateMany.mock.calls[0] as [{ data: { vendorId: string; function: string }[]; skipDuplicates: boolean }];
    expect(args.data).toEqual([
      { vendorId: 'vendor-1', function: 'HALDI' },
      { vendorId: 'vendor-1', function: 'SANGEET' },
    ]);
    expect(args.skipDuplicates).toBe(true);
  });

  test('approving an application with no capabilities selected does not call createMany at all', async () => {
    const application = fakeApplication({ capabilities: [] });
    const mocks = makeMocks(application);
    const service = await loadServiceWith(mocks);

    await service.updateStatus('app-1', 'APPROVED');

    expect(mocks.vendorCapabilityCreateMany).not.toHaveBeenCalled();
  });

  test('a non-approval status change never provisions a vendor or capabilities', async () => {
    const application = fakeApplication({ capabilities: ['HALDI'] });
    const mocks = makeMocks(application);
    const service = await loadServiceWith(mocks);

    await service.updateStatus('app-1', 'REJECTED');

    expect(mocks.vendorCreate).not.toHaveBeenCalled();
    expect(mocks.vendorCapabilityCreateMany).not.toHaveBeenCalled();
  });

  test('re-approving an application that already has a vendorId never re-provisions capabilities', async () => {
    const application = fakeApplication({ status: 'APPROVED', vendorId: 'vendor-1', capabilities: ['HALDI'] });
    const mocks = makeMocks(application);
    const service = await loadServiceWith(mocks);

    await service.updateStatus('app-1', 'APPROVED');

    expect(mocks.vendorCapabilityCreateMany).not.toHaveBeenCalled();
  });
});
