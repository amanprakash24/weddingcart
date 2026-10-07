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

type ExistingUser = { id: string; phone: string; loginCodeHash: string | null; roles: { role: string }[]; vendorProfile: { vendorId: string } | null };

function makeMocks(application: ReturnType<typeof fakeApplication>, existingUser: ExistingUser | null = null) {
  const vendorCapabilityCreateMany = mock(async (args: { data: unknown[] }) => ({ count: args.data.length }));
  const userFindUnique = mock(async () => existingUser);
  const userCreate = mock(async () => ({ id: 'user-1' }));
  const userUpdate = mock(async (args: { where: { id: string }; data: { loginCodeHash: string; loginCodeSetAt: Date } }) => args);
  const userRoleUpsert = mock(async () => ({}));
  const vendorProfileCreate = mock(async () => ({}));

  const tx = {
    user: { findUnique: userFindUnique, create: userCreate, update: userUpdate },
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

  return { prismaMock, vendorApplicationRepository, vendorRepository, vendorCapabilityCreateMany, vendorCreate: vendorRepository.create, vendorProfileCreate, userUpdate };
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

describe('vendorApplicationService.updateStatus — the vendor’s first login code', () => {
  test('the first approval issues a 6-digit code, hands it back once, and stores only its hash on the new login', async () => {
    const mocks = makeMocks(fakeApplication());
    const service = await loadServiceWith(mocks);

    const result = await service.updateStatus('app-1', 'APPROVED');

    expect(result?.issuedLoginCode).toMatch(/^\d{6}$/);
    // The owner link carries no code any more; the code is the person's.
    expect((mocks.vendorProfileCreate.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data).toEqual({ userId: 'user-1', vendorId: 'vendor-1' });
    const [args] = mocks.userUpdate.mock.calls[0] as unknown as [{ where: { id: string }; data: { loginCodeHash: string; loginCodeSetAt: Date } }];
    expect(args.where).toEqual({ id: 'user-1' });
    expect(args.data.loginCodeSetAt).toBeInstanceOf(Date);
    expect(args.data.loginCodeHash).toMatch(/^\$2[aby]\$/); // a bcrypt hash …
    expect(args.data.loginCodeHash).not.toContain(result!.issuedLoginCode!); // … never the code itself
    const bcrypt = (await import('bcryptjs')).default;
    expect(await bcrypt.compare(result!.issuedLoginCode!, args.data.loginCodeHash)).toBe(true);
  });

  // A registration can be typed with ANY mobile number. If approving it replaced that number's code and showed the new one to
  // the approver, a registration would be a way to take over someone else's login.
  test('a mobile number that already has a login code keeps it: nothing is replaced, nothing is shown', async () => {
    const owner: ExistingUser = { id: 'user-9', phone: '9876543210', loginCodeHash: 'existing-hash', roles: [{ role: 'VENDOR' }], vendorProfile: null };
    const mocks = makeMocks(fakeApplication(), owner);
    const result = await (await loadServiceWith(mocks)).updateStatus('app-1', 'APPROVED');

    expect(result?.issuedLoginCode).toBeUndefined();
    expect(result?.existingLogin).toBe(true);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    // They still become this vendor's owner — with the sign-in they already have.
    expect((mocks.vendorProfileCreate.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data).toEqual({ userId: 'user-9', vendorId: 'vendor-1' });
  });

  test('a mobile number that belongs to Shaadi Shopping’s own team is never given a code by an approval — even if it has none', async () => {
    for (const role of ['SUPER_ADMIN', 'SALES', 'OPERATIONS']) {
      const teamMember: ExistingUser = { id: 'user-9', phone: '9876543210', loginCodeHash: null, roles: [{ role }], vendorProfile: null };
      const mocks = makeMocks(fakeApplication(), teamMember);
      const result = await (await loadServiceWith(mocks)).updateStatus('app-1', 'APPROVED');
      expect(result?.issuedLoginCode).toBeUndefined();
      expect(result?.existingLogin).toBe(true);
      expect(mocks.userUpdate).not.toHaveBeenCalled();
    }
  });

  test('rejecting, or saving an already-approved application again, issues no code', async () => {
    const rejected = await (await loadServiceWith(makeMocks(fakeApplication()))).updateStatus('app-1', 'REJECTED');
    expect(rejected && 'issuedLoginCode' in rejected ? rejected.issuedLoginCode : undefined).toBeUndefined();

    const mocks = makeMocks(fakeApplication({ status: 'APPROVED', vendorId: 'vendor-1' }));
    const again = await (await loadServiceWith(mocks)).updateStatus('app-1', 'APPROVED');
    expect(again && 'issuedLoginCode' in again ? again.issuedLoginCode : undefined).toBeUndefined();
    expect(mocks.vendorProfileCreate).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });
});
