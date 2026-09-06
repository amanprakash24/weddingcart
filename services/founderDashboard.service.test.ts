/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';

// Mocks `@/lib/prisma` wholesale (no DATABASE_URL/DB connection needed, same
// technique as commandCenter.service.test.ts) with a tiny in-memory invoice
// fixture set. Only `getRevenue()` is exercised here — it's exported
// specifically for this — so the mock only needs to cover the 3 Prisma calls
// that function actually makes: invoice.findMany (paid/outstanding source),
// invoice.aggregate (invoicedThisMonth, untouched by this fix), and
// payment.aggregate (paymentsToday, untouched by this fix).
interface FixtureInvoice {
  status: 'DRAFT' | 'SENT' | 'PAID';
  total: number;
  amountPaid: number;
  weddingId: string | null;
  payments: { status: 'SUCCESS' | 'FAILED'; amount: number }[];
}

function makeInvoiceFindMany(fixtures: FixtureInvoice[]) {
  return mock(async (args: { where: { status: { not?: string } } }) => {
    const matches = fixtures.filter((inv) => inv.status !== args.where.status.not);
    return matches.map((inv) => ({
      status: inv.status,
      total: inv.total,
      amountPaid: inv.amountPaid,
      weddingId: inv.weddingId,
      payments: inv.payments.filter((p) => p.status === 'SUCCESS').map((p) => ({ amount: p.amount })),
    }));
  });
}

async function loadGetRevenueWith(fixtures: FixtureInvoice[]) {
  mock.module('@/lib/prisma', () => ({
    prisma: {
      invoice: {
        findMany: makeInvoiceFindMany(fixtures),
        aggregate: mock(async () => ({ _sum: { total: 0 }, _count: 0 })),
      },
      payment: { aggregate: mock(async () => ({ _sum: { amount: 0 } })) },
    },
  }));
  const { getRevenue } = await import('./founderDashboard.service');
  return getRevenue;
}

describe('founderDashboard.service getRevenue — Payment sums for wedding-linked invoices, Invoice.amountPaid for standalone ones', () => {
  test('respects Invoice.amountPaid for a standalone invoice with zero Payment rows', async () => {
    const getRevenue = await loadGetRevenueWith([
      {
        status: 'SENT',
        total: 10000,
        amountPaid: 4000, // only source of truth — no Payment rows exist for this invoice
        weddingId: null,
        payments: [],
      },
    ]);

    const revenue = await getRevenue();
    expect(revenue.outstanding).toBe(6000);
    expect(revenue.totalCollected).toBe(4000);
  });

  test('respects the Payment sum for a wedding-linked invoice, ignoring a stale/zero amountPaid', async () => {
    const getRevenue = await loadGetRevenueWith([
      {
        status: 'SENT',
        total: 8000,
        amountPaid: 0, // stale — payment.service.ts never writes this column
        weddingId: 'wedding-1',
        payments: [{ status: 'SUCCESS', amount: 3000 }],
      },
    ]);

    const revenue = await getRevenue();
    expect(revenue.outstanding).toBe(5000);
    expect(revenue.totalCollected).toBe(3000);
  });

  test('sums only SUCCESS payments for a wedding-linked invoice with a partial and a failed payment', async () => {
    const getRevenue = await loadGetRevenueWith([
      {
        status: 'SENT',
        total: 12000,
        amountPaid: 0,
        weddingId: 'wedding-1',
        payments: [
          { status: 'SUCCESS', amount: 3000 },
          { status: 'SUCCESS', amount: 4000 },
          { status: 'FAILED', amount: 5000 }, // must not count
        ],
      },
    ]);

    const revenue = await getRevenue();
    expect(revenue.outstanding).toBe(5000); // 12000 - 7000
    expect(revenue.totalCollected).toBe(7000);
  });

  test('excludes DRAFT invoices entirely and excludes PAID invoices from outstanding while still counting their collection', async () => {
    const getRevenue = await loadGetRevenueWith([
      { status: 'DRAFT', total: 99999, amountPaid: 0, weddingId: null, payments: [] },
      {
        status: 'PAID',
        total: 5000,
        amountPaid: 0,
        weddingId: 'wedding-1',
        payments: [{ status: 'SUCCESS', amount: 5000 }],
      },
    ]);

    const revenue = await getRevenue();
    expect(revenue.outstanding).toBe(0); // PAID invoice excluded from the outstanding population entirely
    expect(revenue.totalCollected).toBe(5000); // but its collection still counts (status != DRAFT)
  });

  test('combines a standalone and a wedding-linked invoice correctly in the same batch', async () => {
    const getRevenue = await loadGetRevenueWith([
      { status: 'SENT', total: 10000, amountPaid: 4000, weddingId: null, payments: [] },
      {
        status: 'SENT',
        total: 8000,
        amountPaid: 0,
        weddingId: 'wedding-1',
        payments: [{ status: 'SUCCESS', amount: 3000 }],
      },
    ]);

    const revenue = await getRevenue();
    expect(revenue.outstanding).toBe(6000 + 5000);
    expect(revenue.totalCollected).toBe(4000 + 3000);
  });
});
