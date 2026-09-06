/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';

// Mocks `@/lib/prisma` wholesale (never loads the real module, so no
// DATABASE_URL/DB connection needed — same technique as
// services/booking.service.test.ts) with a tiny in-memory invoice/payment
// fixture set. `invoice.findMany`'s mock implementation actually applies the
// same `where.status`/`payments.where: { status: 'SUCCESS' }` filtering the
// real Prisma query would, so a passing test here is real evidence the query
// shape in commandCenter.service.ts is correct, not just that the JS-side
// arithmetic is correct.
interface FixtureInvoice {
  id: string;
  status: 'DRAFT' | 'SENT' | 'PAID';
  total: number;
  amountPaid: number;
  weddingId: string | null;
  clientName: string;
  invoiceNumber: string;
  payments: { status: 'SUCCESS' | 'FAILED'; amount: number }[];
}

function makeInvoiceFindMany(fixtures: FixtureInvoice[]) {
  return mock(async (args: { where: { status: { not?: string; notIn?: string[] } } }) => {
    const { status } = args.where;
    const matches =
      'notIn' in status && status.notIn
        ? fixtures.filter((inv) => !status.notIn!.includes(inv.status))
        : fixtures.filter((inv) => inv.status !== status.not);

    return matches.map((inv) => ({
      id: inv.id,
      clientName: inv.clientName,
      invoiceNumber: inv.invoiceNumber,
      total: inv.total,
      amountPaid: inv.amountPaid,
      weddingId: inv.weddingId,
      payments: inv.payments.filter((p) => p.status === 'SUCCESS').map((p) => ({ amount: p.amount })),
      paymentLinks: [] as { expiresAt: Date }[],
    }));
  });
}

function basePrismaMock(fixtures: FixtureInvoice[]) {
  const zero = mock(async () => 0);
  const empty = mock(async () => []);
  return {
    lead: { count: zero },
    enquiry: { count: zero },
    consultation: { count: zero },
    task: { count: zero, findMany: empty },
    weddingEvent: { count: zero, findMany: empty },
    invoice: { findMany: makeInvoiceFindMany(fixtures) },
    payment: { findMany: empty },
  };
}

async function loadServiceWith(fixtures: FixtureInvoice[]) {
  mock.module('@/lib/prisma', () => ({ prisma: basePrismaMock(fixtures) }));
  const { commandCenterService } = await import('./commandCenter.service');
  return commandCenterService;
}

describe('commandCenterService.getDashboard — finance (live Payment rows for wedding-linked invoices, Invoice.amountPaid for standalone ones)', () => {
  test('excludes a wedding-linked invoice from duePayments once successful Payments cover it in full, even if status has not flipped to PAID yet', async () => {
    const fixtures: FixtureInvoice[] = [
      {
        id: 'inv-lagging',
        status: 'SENT', // status hasn't caught up to PAID — this is the exact bug this fix targets
        total: 6000,
        amountPaid: 0, // stale/never-written for a wedding-linked invoice — must be ignored
        weddingId: 'wedding-1',
        clientName: 'Lagging Client',
        invoiceNumber: 'INV-LAG',
        payments: [{ status: 'SUCCESS', amount: 6000 }],
      },
    ];
    const commandCenterService = await loadServiceWith(fixtures);
    const dashboard = await commandCenterService.getDashboard();

    expect(dashboard.today.paymentsDue).toBe(0);
    expect(dashboard.finance.duePayments).toHaveLength(0);
    expect(dashboard.finance.outstanding).toBe(0);
  });

  test('computes outstanding/duePayments correctly across unpaid, partially paid, and multiple-payment wedding-linked invoices, ignoring non-SUCCESS payments', async () => {
    const fixtures: FixtureInvoice[] = [
      {
        id: 'inv-partial',
        status: 'SENT',
        total: 10000,
        amountPaid: 0,
        weddingId: 'wedding-1',
        clientName: 'Partial Client',
        invoiceNumber: 'INV-A',
        payments: [{ status: 'SUCCESS', amount: 4000 }],
      },
      {
        id: 'inv-paid',
        status: 'PAID', // excluded from duePayments by status; contributes 0 to outstanding
        total: 5000,
        amountPaid: 0,
        weddingId: 'wedding-1',
        clientName: 'Paid Client',
        invoiceNumber: 'INV-B',
        payments: [{ status: 'SUCCESS', amount: 5000 }],
      },
      {
        id: 'inv-unpaid',
        status: 'SENT',
        total: 8000,
        amountPaid: 0,
        weddingId: 'wedding-1',
        clientName: 'Unpaid Client',
        invoiceNumber: 'INV-C',
        payments: [],
      },
      {
        id: 'inv-multi',
        status: 'SENT',
        total: 12000,
        amountPaid: 0,
        weddingId: 'wedding-1',
        clientName: 'Multi Payment Client',
        invoiceNumber: 'INV-D',
        payments: [
          { status: 'SUCCESS', amount: 3000 },
          { status: 'SUCCESS', amount: 4000 },
          { status: 'FAILED', amount: 5000 }, // must not count toward paid amount
        ],
      },
      {
        id: 'inv-draft',
        status: 'DRAFT', // must never appear in either figure
        total: 99999,
        amountPaid: 0,
        weddingId: 'wedding-1',
        clientName: 'Draft Client',
        invoiceNumber: 'INV-DRAFT',
        payments: [],
      },
    ];
    const commandCenterService = await loadServiceWith(fixtures);
    const dashboard = await commandCenterService.getDashboard();

    // outstanding: (10000-4000) + (5000-5000) + (8000-0) + (12000-7000) = 6000+0+8000+5000
    expect(dashboard.finance.outstanding).toBe(19000);

    // duePayments: inv-partial, inv-unpaid, inv-multi (inv-paid excluded by
    // status, inv-draft excluded by status)
    expect(dashboard.today.paymentsDue).toBe(3);
    const byInvoiceNumber = Object.fromEntries(dashboard.finance.duePayments.map((d) => [d.invoiceNumber, d.amount]));
    expect(byInvoiceNumber['INV-A']).toBe(6000);
    expect(byInvoiceNumber['INV-C']).toBe(8000);
    expect(byInvoiceNumber['INV-D']).toBe(5000); // FAILED payment correctly excluded from the paid sum
    expect(byInvoiceNumber['INV-B']).toBeUndefined();
    expect(byInvoiceNumber['INV-DRAFT']).toBeUndefined();
  });

  test('respects Invoice.amountPaid for a standalone invoice with zero Payment rows, while a wedding-linked invoice in the same batch still uses its Payment sum', async () => {
    const fixtures: FixtureInvoice[] = [
      {
        id: 'inv-standalone',
        status: 'SENT',
        total: 10000,
        amountPaid: 4000, // the only source of truth for this invoice — no Payment rows exist for it
        weddingId: null, // legacy/admin invoice, created via /api/invoices — no Razorpay integration
        clientName: 'Standalone Client',
        invoiceNumber: 'INV-STANDALONE',
        payments: [],
      },
      {
        id: 'inv-wedding',
        status: 'SENT',
        total: 8000,
        amountPaid: 0, // stale/never-written — must be ignored in favor of the real Payment row below
        weddingId: 'wedding-1',
        clientName: 'Wedding Client',
        invoiceNumber: 'INV-WEDDING',
        payments: [{ status: 'SUCCESS', amount: 3000 }],
      },
    ];
    const commandCenterService = await loadServiceWith(fixtures);
    const dashboard = await commandCenterService.getDashboard();

    // outstanding: (10000-4000) + (8000-3000) = 6000 + 5000
    expect(dashboard.finance.outstanding).toBe(11000);
    expect(dashboard.today.paymentsDue).toBe(2);
    const byInvoiceNumber = Object.fromEntries(dashboard.finance.duePayments.map((d) => [d.invoiceNumber, d.amount]));
    expect(byInvoiceNumber['INV-STANDALONE']).toBe(6000); // respects amountPaid, not the empty Payment array
    expect(byInvoiceNumber['INV-WEDDING']).toBe(5000); // respects the Payment sum, not the stale amountPaid=0
  });

  test('treats a fully-paid-via-amountPaid standalone invoice as settled even though it has zero Payment rows', async () => {
    const fixtures: FixtureInvoice[] = [
      {
        id: 'inv-standalone-paid',
        status: 'SENT', // admin never flipped status to PAID, but amountPaid already covers the total
        total: 5000,
        amountPaid: 5000,
        weddingId: null,
        clientName: 'Fully Paid Standalone Client',
        invoiceNumber: 'INV-STANDALONE-PAID',
        payments: [],
      },
    ];
    const commandCenterService = await loadServiceWith(fixtures);
    const dashboard = await commandCenterService.getDashboard();

    expect(dashboard.today.paymentsDue).toBe(0);
    expect(dashboard.finance.duePayments).toHaveLength(0);
    expect(dashboard.finance.outstanding).toBe(0);
  });
});
