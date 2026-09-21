/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { InvalidTransitionError, NotFoundError } from '@/lib/errors';

// Mocks `@/lib/prisma` wholesale (no DATABASE_URL/DB connection needed, same
// technique used throughout this repo) — the full weddingWorkspace.service.ts
// module imports ~11 repositories, all of which transitively import
// @/lib/prisma at module-load time, so this is the one mock point that
// satisfies every one of them without needing to mock each repository
// module individually.
function fakeVendorBooking(status: string) {
  return {
    id: 'vb-1',
    weddingEventId: 'we-1',
    vendorId: 'vendor-1',
    status,
    declineReason: null,
    respondedAt: null,
    onTimeService: null,
  };
}

function makePrismaMock({
  vendorBookingStatus,
  weddingId = 'wedding-1',
}: {
  vendorBookingStatus: string;
  weddingId?: string;
}) {
  const updateMock = mock(async (args: { data: Record<string, unknown> }) => ({
    ...fakeVendorBooking(vendorBookingStatus),
    ...args.data,
  }));
  const activityLogCreateMock = mock(async () => ({ id: 'log-1' }));

  const base = {
    vendorBooking: {
      findUnique: mock(async () => fakeVendorBooking(vendorBookingStatus)),
      update: updateMock,
    },
    weddingEvent: {
      findUnique: mock(async () => ({ id: 'we-1', weddingId })),
    },
    task: { updateMany: mock(async () => ({ count: 1 })) },
    activityLog: {
      create: activityLogCreateMock,
    },
    wedding: {
      findUnique: mock(async () => ({ id: weddingId, status: 'ACTIVE' })), // not PLANNING, so maybeActivateWedding no-ops
      update: mock(async () => ({ id: weddingId, status: 'ACTIVE' })),
    },
  };
  const prismaMock = {
    ...base,
    $transaction: mock(async (fn: (tx: typeof base) => unknown) => fn(base)),
  };
  return { prismaMock, updateMock, activityLogCreateMock };
}

async function loadServiceWith(prismaMock: unknown) {
  mock.module('@/lib/prisma', () => ({ prisma: prismaMock }));
  const { weddingWorkspaceService } = await import('./weddingWorkspace.service');
  return weddingWorkspaceService;
}

describe('weddingWorkspaceService.updateVendorBookingStatus — transition enforcement', () => {
  test('a legal transition (PENDING_VENDOR_CONFIRMATION -> CONFIRMED) succeeds', async () => {
    const { prismaMock, updateMock } = makePrismaMock({ vendorBookingStatus: 'PENDING_VENDOR_CONFIRMATION' });
    const service = await loadServiceWith(prismaMock);

    const result = await service.updateVendorBookingStatus('wedding-1', 'vb-1', 'CONFIRMED');

    expect(result.status).toBe('CONFIRMED');
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  test('an illegal transition (DECLINED -> COMPLETED) throws InvalidTransitionError before any database update', async () => {
    const { prismaMock, updateMock, activityLogCreateMock } = makePrismaMock({ vendorBookingStatus: 'DECLINED' });
    const service = await loadServiceWith(prismaMock);

    await expect(service.updateVendorBookingStatus('wedding-1', 'vb-1', 'COMPLETED')).rejects.toThrow(
      InvalidTransitionError
    );

    // The whole point of enforcing this before the transaction: neither the
    // vendor booking update nor the activity log write should ever fire for
    // a rejected transition.
    expect(updateMock).not.toHaveBeenCalled();
    expect(activityLogCreateMock).not.toHaveBeenCalled();
  });

  test('an illegal transition (CANCELLED -> COMPLETED) is also rejected', async () => {
    const { prismaMock, updateMock } = makePrismaMock({ vendorBookingStatus: 'CANCELLED' });
    const service = await loadServiceWith(prismaMock);

    await expect(service.updateVendorBookingStatus('wedding-1', 'vb-1', 'COMPLETED')).rejects.toThrow(
      InvalidTransitionError
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('the existing ownership check still runs first — a booking belonging to a different wedding is rejected as not found, not as an illegal transition', async () => {
    const { prismaMock, updateMock } = makePrismaMock({
      vendorBookingStatus: 'PENDING_VENDOR_CONFIRMATION',
      weddingId: 'some-other-wedding',
    });
    const service = await loadServiceWith(prismaMock);

    await expect(service.updateVendorBookingStatus('wedding-1', 'vb-1', 'CONFIRMED')).rejects.toThrow(NotFoundError);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

// ---- transitionStatus: completing a wedding ----
// V1 model: a wedding is completable without any vendor ever confirming. PLANNING -> COMPLETED is allowed by the matrix, and the
// service adds exactly one rule to that new path — the wedding's last day must have arrived. Nothing else (vendors, tasks, money)
// is consulted, and ACTIVE -> COMPLETED behaves as it always did.
const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

function makeWeddingPrismaMock({ status, primaryDate, functionDates = [] }: { status: string; primaryDate: Date; functionDates?: Date[] }) {
  const wedding = { id: 'wedding-1', status, primaryDate };
  const weddingUpdate = mock(async (args: { data: Record<string, unknown> }) => ({ ...wedding, ...args.data }));
  const activityLogCreate = mock(async () => ({ id: 'log-1' }));
  const vendorBookingAny = mock(async () => {
    throw new Error('vendor bookings must not be consulted when transitioning a wedding');
  });
  const base = {
    wedding: { findUnique: mock(async () => wedding), update: weddingUpdate },
    weddingEvent: {
      findMany: mock(async () => functionDates.map((date, i) => ({ id: `we-${i}`, weddingId: 'wedding-1', date }))),
      count: mock(async () => functionDates.length),
    },
    activityLog: { create: activityLogCreate },
    vendorBooking: { findMany: vendorBookingAny, findUnique: vendorBookingAny, count: vendorBookingAny },
  };
  const prismaMock = { ...base, $transaction: mock(async (fn: (tx: typeof base) => unknown) => fn(base)) };
  return { prismaMock, weddingUpdate, activityLogCreate };
}

async function outcome(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(() => null, (e: unknown) => e);
}

describe('weddingWorkspaceService.transitionStatus — completing a wedding', () => {
  test('a vendorless PLANNING wedding whose day has passed CAN be completed, and completedAt is set', async () => {
    const past = daysFromNow(-3);
    const { prismaMock, weddingUpdate, activityLogCreate } = makeWeddingPrismaMock({ status: 'PLANNING', primaryDate: past, functionDates: [past] });
    const service = await loadServiceWith(prismaMock);

    const result = await service.transitionStatus('wedding-1', 'COMPLETED');

    expect(result.status).toBe('COMPLETED');
    expect(weddingUpdate).toHaveBeenCalledTimes(1);
    const data = weddingUpdate.mock.calls[0][0].data;
    expect(data.status).toBe('COMPLETED');
    expect(data.completedAt).toBeInstanceOf(Date);
    expect(activityLogCreate).toHaveBeenCalledTimes(1);
  });

  test('a PLANNING wedding with no function rows at all completes on its own date (primaryDate alone)', async () => {
    const { prismaMock, weddingUpdate } = makeWeddingPrismaMock({ status: 'PLANNING', primaryDate: daysFromNow(-1), functionDates: [] });
    const service = await loadServiceWith(prismaMock);
    await service.transitionStatus('wedding-1', 'COMPLETED');
    expect(weddingUpdate).toHaveBeenCalledTimes(1);
  });

  test('PLANNING -> COMPLETED before the wedding is refused with a plain message, and nothing is written', async () => {
    const future = daysFromNow(30);
    const { prismaMock, weddingUpdate, activityLogCreate } = makeWeddingPrismaMock({ status: 'PLANNING', primaryDate: future, functionDates: [future] });
    const service = await loadServiceWith(prismaMock);

    const error = (await outcome(service.transitionStatus('wedding-1', 'COMPLETED'))) as Error;

    expect(error).toBeInstanceOf(InvalidTransitionError);
    expect(error.message).toContain('last day');
    expect(weddingUpdate).not.toHaveBeenCalled();
    expect(activityLogCreate).not.toHaveBeenCalled();
  });

  test('a multi-day PLANNING wedding cannot be completed while a later function is still ahead', async () => {
    const { prismaMock, weddingUpdate } = makeWeddingPrismaMock({
      status: 'PLANNING', primaryDate: daysFromNow(-1), functionDates: [daysFromNow(-2), daysFromNow(-1), daysFromNow(3)],
    });
    const service = await loadServiceWith(prismaMock);
    expect(await outcome(service.transitionStatus('wedding-1', 'COMPLETED'))).toBeInstanceOf(InvalidTransitionError);
    expect(weddingUpdate).not.toHaveBeenCalled();
  });

  test('ACTIVE -> COMPLETED is unchanged — it still works with no date check', async () => {
    const future = daysFromNow(30);
    const { prismaMock, weddingUpdate } = makeWeddingPrismaMock({ status: 'ACTIVE', primaryDate: future, functionDates: [future] });
    const service = await loadServiceWith(prismaMock);
    const result = await service.transitionStatus('wedding-1', 'COMPLETED');
    expect(result.status).toBe('COMPLETED');
    expect(weddingUpdate).toHaveBeenCalledTimes(1);
  });

  test('ACTIVE -> POSTPONED and PLANNING -> POSTPONED / CANCELLED are unaffected by the completion rule', async () => {
    const future = daysFromNow(30);
    for (const [from, to] of [['ACTIVE', 'POSTPONED'], ['PLANNING', 'POSTPONED'], ['PLANNING', 'CANCELLED']] as const) {
      const { prismaMock, weddingUpdate } = makeWeddingPrismaMock({ status: from, primaryDate: future, functionDates: [future] });
      const service = await loadServiceWith(prismaMock);
      const result = await service.transitionStatus('wedding-1', to);
      expect(result.status).toBe(to);
      expect(weddingUpdate.mock.calls[0][0].data.completedAt).toBeUndefined();
    }
  });

  test('still-illegal moves stay illegal: PLANNING -> ACTIVE, POSTPONED -> COMPLETED, COMPLETED -> anything, CANCELLED -> COMPLETED', async () => {
    const past = daysFromNow(-3);
    for (const [from, to] of [['PLANNING', 'ACTIVE'], ['POSTPONED', 'COMPLETED'], ['COMPLETED', 'PLANNING'], ['CANCELLED', 'COMPLETED']] as const) {
      const { prismaMock, weddingUpdate } = makeWeddingPrismaMock({ status: from, primaryDate: past, functionDates: [past] });
      const service = await loadServiceWith(prismaMock);
      expect(await outcome(service.transitionStatus('wedding-1', to))).toBeInstanceOf(InvalidTransitionError);
      expect(weddingUpdate).not.toHaveBeenCalled();
    }
  });
});

// ---- Plan tab: coordinator, task editing, and vendor tasks that close themselves ----
function makePlanMock(over: { taskWeddingId?: string; taskTitle?: string; staff?: boolean; vendorBookingStatus?: string } = {}) {
  const weddingRow = { id: 'wedding-1', status: 'PLANNING', primaryDate: new Date(), coordinatorId: null };
  const taskRow = { id: 'task-1', weddingId: over.taskWeddingId ?? 'wedding-1', title: over.taskTitle ?? 'Book the band', status: 'PENDING' };
  const weddingUpdate = mock(async (args: { data: Record<string, unknown> }) => ({ ...weddingRow, ...args.data }));
  const taskUpdate = mock(async (args: { data: Record<string, unknown> }) => ({ ...taskRow, ...args.data }));
  const taskUpdateMany = mock(async (args: Record<string, unknown>) => ({ count: args ? 1 : 0 }));
  const logCreate = mock(async () => ({ id: 'log-1' }));
  const vbUpdate = mock(async (args: { data: Record<string, unknown> }) => ({ id: 'vb-1', ...args.data }));
  const vbCreate = mock(async (args: { data: Record<string, unknown> }) => ({ id: 'vb-new', ...args.data }));
  const base = {
    wedding: { findUnique: mock(async () => weddingRow), update: weddingUpdate },
    user: { findFirst: mock(async () => (over.staff === false ? null : { id: 'staff-1', name: 'Asha' })) },
    task: { findUnique: mock(async () => taskRow), update: taskUpdate, updateMany: taskUpdateMany, create: mock(async () => ({ id: 'task-x' })) },
    activityLog: { create: logCreate },
    weddingEvent: { findUnique: mock(async () => ({ id: 'we-1', weddingId: 'wedding-1' })) },
    vendor: { findUnique: mock(async () => ({ id: 'vendor-1', name: 'Lens Studio' })) },
    vendorBooking: { findUnique: mock(async () => ({ id: 'vb-1', weddingEventId: 'we-1', status: over.vendorBookingStatus ?? 'PENDING_VENDOR_CONFIRMATION', respondedAt: null, onTimeService: null })), update: vbUpdate, create: vbCreate },
  };
  const prismaMock = { ...base, $transaction: mock(async (fn: (tx: typeof base) => unknown) => fn(base)) };
  return { prismaMock, weddingUpdate, taskUpdate, taskUpdateMany, logCreate };
}

const failure = async (promise: Promise<unknown>) => promise.then(() => null, (e: unknown) => e as Error);

describe('weddingWorkspaceService.assignCoordinator', () => {
  test('connects the staff member and records who was assigned', async () => {
    const { prismaMock, weddingUpdate, logCreate } = makePlanMock();
    const service = await loadServiceWith(prismaMock);
    await service.assignCoordinator('wedding-1', 'staff-1', 'actor-1');
    expect(weddingUpdate.mock.calls[0][0].data.coordinator).toEqual({ connect: { id: 'staff-1' } });
    expect((logCreate.mock.calls[0] as unknown as [{ data: { summary: string } }])[0].data.summary).toBe('Coordinator assigned: Asha');
  });

  test('null removes the coordinator', async () => {
    const { prismaMock, weddingUpdate } = makePlanMock();
    const service = await loadServiceWith(prismaMock);
    await service.assignCoordinator('wedding-1', null, null);
    expect(weddingUpdate.mock.calls[0][0].data.coordinator).toEqual({ disconnect: true });
  });

  test('someone who is not on the team cannot be made coordinator, and nothing is written', async () => {
    const { prismaMock, weddingUpdate } = makePlanMock({ staff: false });
    const service = await loadServiceWith(prismaMock);
    expect(await failure(service.assignCoordinator('wedding-1', 'customer-9', null))).toBeInstanceOf(NotFoundError);
    expect(weddingUpdate).not.toHaveBeenCalled();
  });
});

describe('weddingWorkspaceService.updateTask', () => {
  test('changes only what is sent; a due date, priority and assignee are all editable', async () => {
    const { prismaMock, taskUpdate } = makePlanMock();
    const service = await loadServiceWith(prismaMock);
    const due = new Date('2026-10-01T00:00:00Z');
    await service.updateTask('wedding-1', 'task-1', { dueAt: due, priority: 'URGENT', assignedToId: 'staff-1' });
    expect(taskUpdate.mock.calls[0][0].data).toEqual({ dueAt: due, priority: 'URGENT', assignedTo: { connect: { id: 'staff-1' } } });
  });

  test('done stamps completedAt; reopening clears it; null clears the due date and the assignee', async () => {
    const { prismaMock, taskUpdate } = makePlanMock();
    const service = await loadServiceWith(prismaMock);
    await service.updateTask('wedding-1', 'task-1', { status: 'DONE' });
    expect(taskUpdate.mock.calls[0][0].data.completedAt).toBeInstanceOf(Date);
    await service.updateTask('wedding-1', 'task-1', { status: 'PENDING', dueAt: null, assignedToId: null });
    expect(taskUpdate.mock.calls[1][0].data).toMatchObject({ status: 'PENDING', completedAt: null, dueAt: null, assignedTo: { disconnect: true } });
  });

  test('a task of another wedding is not found; a blank title and a non-staff assignee are refused', async () => {
    const other = makePlanMock({ taskWeddingId: 'wedding-2' });
    expect(await failure((await loadServiceWith(other.prismaMock)).updateTask('wedding-1', 'task-1', { title: 'x' }))).toBeInstanceOf(NotFoundError);
    const { prismaMock, taskUpdate } = makePlanMock({ staff: false });
    const service = await loadServiceWith(prismaMock);
    expect(((await failure(service.updateTask('wedding-1', 'task-1', { title: '   ' }))) as Error).message).toContain('needs a title');
    expect(await failure(service.updateTask('wedding-1', 'task-1', { assignedToId: 'customer-9' }))).toBeInstanceOf(NotFoundError);
    expect(taskUpdate).not.toHaveBeenCalled();
  });
});

describe('vendor tasks close themselves', () => {
  test('confirming a vendor booking finishes its "Confirm booking with…" task; declining cancels it', async () => {
    const confirm = makePlanMock();
    await (await loadServiceWith(confirm.prismaMock)).updateVendorBookingStatus('wedding-1', 'vb-1', 'CONFIRMED');
    expect(confirm.taskUpdateMany.mock.calls[0][0]).toMatchObject({ where: { vendorBookingId: 'vb-1' }, data: { status: 'DONE' } });
    const decline = makePlanMock();
    await (await loadServiceWith(decline.prismaMock)).updateVendorBookingStatus('wedding-1', 'vb-1', 'DECLINED', 'busy');
    expect(decline.taskUpdateMany.mock.calls[0][0]).toMatchObject({ data: { status: 'CANCELLED' } });
  });

  test('assigning a vendor to a quoted service closes that "Assign a vendor for…" task — and only that kind of task', async () => {
    // Other test files replace this repository for the whole process (bun's mock.module is global), so pin the one call this test needs.
    mock.module('@/repositories/vendor.repository', () => ({ vendorRepository: { findById: mock(async () => ({ id: 'vendor-1', name: 'Lens Studio' })) } }));
    const good = makePlanMock({ taskTitle: 'Assign a vendor for "Photography"' });
    await (await loadServiceWith(good.prismaMock)).addVendorBooking('wedding-1', { weddingEventId: 'we-1', vendorId: 'vendor-1', agreedPrice: 12500, resolvesTaskId: 'task-1' }, null);
    expect(good.taskUpdateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'task-1' }, data: { status: 'DONE' } });
    const notThatKind = makePlanMock({ taskTitle: 'Call the caterer' });
    expect(await failure((await loadServiceWith(notThatKind.prismaMock)).addVendorBooking('wedding-1', { weddingEventId: 'we-1', vendorId: 'vendor-1', agreedPrice: 1, resolvesTaskId: 'task-1' }, null))).toBeInstanceOf(NotFoundError);
    expect(notThatKind.taskUpdateMany).not.toHaveBeenCalled();
  });
});
