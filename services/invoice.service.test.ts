/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { InvalidTransitionError } from '@/lib/errors';

// Mocks `@/lib/prisma` wholesale (no DATABASE_URL/DB connection needed, same
// technique used in weddingWorkspace.service.test.ts) — invoice.service.ts
// imports generateInvoiceNumber from weddingWorkspace.service.ts, which pulls
// in ~11 repositories that all transitively import @/lib/prisma at
// module-load time. Mocking at this one boundary and letting the real
// invoiceRepository code run against the mock keeps this consistent with the
// established pattern rather than mocking the repository directly.
function fakeInvoice(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv-1',
    weddingId: null,
    invoiceNumber: 'INV-001',
    clientName: 'Test Client',
    clientPhone: '9999999999',
    clientEmail: null,
    clientCity: null,
    eventDate: null,
    eventType: null,
    subtotal: 1000,
    discount: 0,
    gstEnabled: false,
    gstAmount: 0,
    total: 1000,
    amountPaid: 0,
    notes: null,
    status: 'SENT',
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    payments: [],
    paymentLinks: [],
    ...overrides,
  };
}

function makePrismaMock(existing: Partial<Record<string, unknown>>) {
  const updateMock = mock(async (args: { data: Record<string, unknown> }) => ({
    ...fakeInvoice(existing),
    ...args.data,
  }));
  const base = {
    invoice: {
      findUnique: mock(async () => fakeInvoice(existing)),
      update: updateMock,
    },
    invoiceItem: {
      deleteMany: mock(async () => ({ count: 0 })),
      createMany: mock(async () => ({ count: 0 })),
    },
  };
  const prismaMock = {
    ...base,
    $transaction: mock(async (fn: (tx: typeof base) => unknown) => fn(base)),
  };
  return { prismaMock, updateMock };
}

async function loadServiceWith(prismaMock: unknown) {
  mock.module('@/lib/prisma', () => ({ prisma: prismaMock }));
  const { invoiceService } = await import('./invoice.service');
  return invoiceService;
}

describe('invoiceService.update — status:PAID requires amountPaid >= total', () => {
  test('existing amountPaid < total + status: PAID is rejected before any write', async () => {
    const { prismaMock, updateMock } = makePrismaMock({ amountPaid: 500, total: 1000, status: 'SENT' });
    const service = await loadServiceWith(prismaMock);

    await expect(service.update('inv-1', { status: 'PAID' })).rejects.toThrow(InvalidTransitionError);
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('existing amountPaid === total + status: PAID is accepted', async () => {
    const { prismaMock, updateMock } = makePrismaMock({ amountPaid: 1000, total: 1000, status: 'SENT' });
    const service = await loadServiceWith(prismaMock);

    const result = (await service.update('inv-1', { status: 'PAID' })) as { status: string };

    expect(result.status).toBe('PAID');
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  test('status: PAID with a new amountPaid in the same request is validated against the new amount, not the existing one', async () => {
    const { prismaMock, updateMock } = makePrismaMock({ amountPaid: 500, total: 1000, status: 'SENT' });
    const service = await loadServiceWith(prismaMock);

    await expect(service.update('inv-1', { status: 'PAID', amountPaid: 800 })).rejects.toThrow(
      InvalidTransitionError
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  test('status: PAID with a new amountPaid that reaches the existing total is accepted', async () => {
    const { prismaMock, updateMock } = makePrismaMock({ amountPaid: 500, total: 1000, status: 'SENT' });
    const service = await loadServiceWith(prismaMock);

    const result = (await service.update('inv-1', { status: 'PAID', amountPaid: 1000 })) as { status: string };

    expect(result.status).toBe('PAID');
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  test('status: PAID with both a new amountPaid and a new total is validated against the new total, not the existing one', async () => {
    const { prismaMock, updateMock } = makePrismaMock({ amountPaid: 500, total: 1000, status: 'SENT' });
    const service = await loadServiceWith(prismaMock);

    // amountPaid (1000) would clear the *old* total (1000) but not the new one (1200).
    await expect(service.update('inv-1', { status: 'PAID', amountPaid: 1000, total: 1200 })).rejects.toThrow(
      InvalidTransitionError
    );
    expect(updateMock).not.toHaveBeenCalled();

    const result = (await service.update('inv-1', { status: 'PAID', amountPaid: 1200, total: 1200 })) as {
      status: string;
    };
    expect(result.status).toBe('PAID');
  });

  test('DRAFT/SENT status updates are unaffected by amountPaid being less than total', async () => {
    const { prismaMock, updateMock } = makePrismaMock({ amountPaid: 0, total: 1000, status: 'DRAFT' });
    const service = await loadServiceWith(prismaMock);

    const result = (await service.update('inv-1', { status: 'SENT' })) as { status: string };

    expect(result.status).toBe('SENT');
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  test('the pre-existing amountPaid bounds check (0..total) is still enforced', async () => {
    const { prismaMock, updateMock } = makePrismaMock({ amountPaid: 0, total: 1000, status: 'DRAFT' });
    const service = await loadServiceWith(prismaMock);

    await expect(service.update('inv-1', { amountPaid: 1500 })).rejects.toThrow(InvalidTransitionError);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
