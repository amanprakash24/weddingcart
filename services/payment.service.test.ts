/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';

// The invoice lifecycle around Razorpay (lib/invoice/lifecycle.ts): a payment link is how an invoice reaches the customer, so
// creating one issues it (DRAFT → SENT); a part payment makes it PARTIALLY_PAID and the full amount PAID. Razorpay and the
// database are both faked — no payment link is created and no money moves.
type Row = Record<string, unknown>;

function makeMocks(invoice: Row, payments: Row[] = []) {
  // A tiny stand-in for the invoice row: writes change it, and reads see the payments that exist NOW (the status is worked out from
  // the database under a lock, never from a copy read earlier).
  const state: Row = { ...invoice };
  const paymentRows: Row[] = [...payments];
  const invoiceUpdate = mock(async (args: { data: Row }) => Object.assign(state, args.data));
  const linkCreate = mock(async (args: { data: Row }) => ({ id: 'link-1', ...args.data }));
  const paymentCreate = mock(async (args: { data: Row }) => {
    paymentRows.push({ status: 'SUCCESS', amount: args.data.amount });
    return { id: 'pay-1', ...args.data };
  });
  const base = {
    invoice: {
      findUnique: mock(async () => ({ ...state, items: [], payments: paymentRows, paymentLinks: [] })),
      update: invoiceUpdate,
    },
    $queryRaw: mock(async () => []),
    paymentLink: { create: linkCreate, findFirst: mock(async () => null), findUnique: mock(async () => null), update: mock(async () => ({})) },
    payment: { create: paymentCreate, findMany: mock(async () => []), count: mock(async () => 0) },
    activityLog: { create: mock(async () => ({ id: 'log-1' })) },
  };
  const prismaMock = { ...base, $transaction: mock(async (fn: (tx: typeof base) => unknown) => fn(base)) };
  return { prismaMock, invoiceUpdate, linkCreate, paymentCreate };
}

const razorpayOk = mock(async () => ({ ok: true as const, razorpayPaymentLinkId: 'plink_test', shortUrl: 'https://rzp.test/x' }));

async function load(prismaMock: unknown) {
  mock.module('@/lib/prisma', () => ({ prisma: prismaMock }));
  mock.module('@/lib/razorpay', () => ({ createPaymentLink: razorpayOk }));
  return (await import('./payment.service')).paymentService;
}

const invoice = (over: Row = {}) => ({ id: 'inv-1', weddingId: 'w-1', invoiceNumber: 'INV-1', clientName: 'X', clientPhone: '9', clientEmail: null, total: 50000, status: 'DRAFT', issuedAt: null, ...over });

describe('creating a payment link issues the invoice', () => {
  test('a DRAFT invoice becomes SENT, with an issue date', async () => {
    const { prismaMock, invoiceUpdate, linkCreate } = makeMocks(invoice());
    const service = await load(prismaMock);

    await service.createPaymentLinkForInvoice('w-1', 'inv-1', null);

    expect(linkCreate).toHaveBeenCalledTimes(1);
    expect(invoiceUpdate).toHaveBeenCalledTimes(1);
    const data = invoiceUpdate.mock.calls[0][0].data;
    expect(data.status).toBe('SENT');
    expect(data.issuedAt).toBeInstanceOf(Date);
  });

  test('an invoice already issued is left alone', async () => {
    const { prismaMock, invoiceUpdate } = makeMocks(invoice({ status: 'SENT', issuedAt: new Date() }));
    const service = await load(prismaMock);
    await service.createPaymentLinkForInvoice('w-1', 'inv-1', null);
    expect(invoiceUpdate).not.toHaveBeenCalled();
  });

  test('the amount asked for is the outstanding balance, computed by the server', async () => {
    const { prismaMock } = makeMocks(invoice({ status: 'PARTIALLY_PAID', issuedAt: new Date() }), [{ status: 'SUCCESS', amount: 20000 }]);
    const service = await load(prismaMock);
    razorpayOk.mockClear();
    await service.createPaymentLinkForInvoice('w-1', 'inv-1', null);
    expect((razorpayOk.mock.calls[0] as unknown as [{ amount: number }])[0].amount).toBe(30000 * 100);
  });
});

describe('a paid Razorpay payment moves the invoice status', () => {
  const event = (rupees: number) => ({
    event: 'payment_link.paid',
    payload: {
      payment: { entity: { id: `pay_${rupees}_${Math.random()}`, amount: rupees * 100, method: 'upi', notes: { invoiceId: 'inv-1' } } },
      payment_link: { entity: { id: 'plink_test', notes: { invoiceId: 'inv-1' } } },
    },
  });

  test('part of the total → PARTIALLY_PAID', async () => {
    const { prismaMock, invoiceUpdate } = makeMocks(invoice({ status: 'SENT', issuedAt: new Date() }));
    const service = await load(prismaMock);
    await service.handleWebhookEvent(event(20000));
    expect(invoiceUpdate.mock.calls[0][0].data.status).toBe('PARTIALLY_PAID');
  });

  test('the whole total → PAID', async () => {
    const { prismaMock, invoiceUpdate } = makeMocks(invoice({ status: 'SENT', issuedAt: new Date() }));
    const service = await load(prismaMock);
    await service.handleWebhookEvent(event(50000));
    expect(invoiceUpdate.mock.calls[0][0].data.status).toBe('PAID');
  });

  test('the rest of a part-paid invoice → PAID', async () => {
    const { prismaMock, invoiceUpdate } = makeMocks(invoice({ status: 'PARTIALLY_PAID', issuedAt: new Date() }), [{ status: 'SUCCESS', amount: 20000 }]);
    const service = await load(prismaMock);
    await service.handleWebhookEvent(event(30000));
    expect(invoiceUpdate.mock.calls[0][0].data.status).toBe('PAID');
  });
});
