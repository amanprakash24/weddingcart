/// <reference types="bun-types" />
import { beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';

// Regression for the live Revise failure: a transaction whose steps together take longer than Prisma's 5 s DEFAULT must still
// complete, because the app's client raises the default (lib/prismaPoolConfig.ts). Each step here is slow on purpose, the way
// every step is on the live link.

dbDescribe('slow transactions are not cut off at 5 s (real database)', () => {
  let app: App;
  beforeAll(async () => {
    app = await loadApp();
  });

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  test('a 6.5 s transaction with a query in every step completes and all its writes are kept', async () => {
    const marker = `DBTEST slow tx ${Date.now()}`;
    const started = Date.now();
    await app.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`select 1`;
      await sleep(2000);
      await tx.invoice.create({ data: { invoiceNumber: `INV-SLOW-${Date.now()}`, clientName: marker, clientPhone: '9000000000', subtotal: 1, total: 1 } });
      await sleep(2000);
      await tx.$queryRaw`select 1`;
      await sleep(2500); // total > 6.5 s — past the 5 s default
      await tx.invoice.updateMany({ where: { clientName: marker }, data: { total: 2 } });
    });
    expect(Date.now() - started).toBeGreaterThan(6500);
    const kept = await app.prisma.invoice.findMany({ where: { clientName: marker } });
    expect(kept).toHaveLength(1);
    expect(kept[0].total).toBe(2);
    await app.prisma.invoice.deleteMany({ where: { clientName: marker } });
  });
});
