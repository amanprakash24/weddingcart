/// <reference types="bun-types" />
import { describe, test, expect, mock } from 'bun:test';
import { generateInvoiceNumber, generateWeddingNumber } from './documentNumber.service';

// Both generators take the transaction client as a parameter and import nothing that touches the database,
// so they are tested with a stand-in transaction — no module mocking, nothing shared with other test files.
function makeTx({ lastInvoice = null, lastWedding = null }: { lastInvoice?: string | null; lastWedding?: string | null } = {}) {
  const calls: string[] = [];
  const tx = {
    $executeRaw: mock(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push(`lock:${values[0]}`);
      return 1;
    }),
    invoice: {
      findMany: mock(async (args: { where: { invoiceNumber: { startsWith: string } } }) => {
        calls.push(`read:invoice:${args.where.invoiceNumber.startsWith}`);
        return lastInvoice ? [{ invoiceNumber: lastInvoice }] : [];
      }),
    },
    wedding: {
      findMany: mock(async (args: { where: { weddingNumber: { startsWith: string } } }) => {
        calls.push(`read:wedding:${args.where.weddingNumber.startsWith}`);
        return lastWedding ? [{ weddingNumber: lastWedding }] : [];
      }),
    },
  };
  return { tx: tx as unknown as Parameters<typeof generateInvoiceNumber>[0], calls, raw: tx };
}

const now = new Date();
const month = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
const year = String(now.getFullYear());

describe('generateInvoiceNumber — INV-YYYYMM-NNNN, race-safe', () => {
  test('the first invoice of the month is 0001', async () => {
    const { tx } = makeTx();
    expect(await generateInvoiceNumber(tx)).toBe(`INV-${month}-0001`);
  });

  test('continues from the HIGHEST existing number, not from a row count (a deleted invoice cannot cause a duplicate)', async () => {
    // 0001..0004 existed, 0002 was deleted: a count would say 3 and issue 0004 again.
    const { tx } = makeTx({ lastInvoice: `INV-${month}-0004` });
    expect(await generateInvoiceNumber(tx)).toBe(`INV-${month}-0005`);
  });

  test('takes the bucket lock BEFORE reading the highest number, so concurrent callers cannot read the same one', async () => {
    const { tx, calls } = makeTx({ lastInvoice: `INV-${month}-0009` });
    await generateInvoiceNumber(tx);
    expect(calls).toEqual([`lock:number:INV-${month}-`, `read:invoice:INV-${month}-`]);
  });

  test('reads only the current month bucket, ordered so the highest comes first', async () => {
    const { tx, raw } = makeTx();
    await generateInvoiceNumber(tx);
    const args = raw.invoice.findMany.mock.calls[0][0] as unknown as { orderBy: unknown; take: number; where: unknown };
    expect(args.orderBy).toEqual({ invoiceNumber: 'desc' });
    expect(args.take).toBe(1);
  });
});

describe('generateWeddingNumber — WED-YYYY-NNNN, race-safe', () => {
  test('the first wedding of the year is 0001', async () => {
    const { tx } = makeTx();
    expect(await generateWeddingNumber(tx)).toBe(`WED-${year}-0001`);
  });

  test('continues from the highest existing number', async () => {
    const { tx } = makeTx({ lastWedding: `WED-${year}-0041` });
    expect(await generateWeddingNumber(tx)).toBe(`WED-${year}-0042`);
  });

  test('locks its own bucket first, separate from the invoice bucket', async () => {
    const { tx, calls } = makeTx();
    await generateWeddingNumber(tx);
    expect(calls).toEqual([`lock:number:WED-${year}-`, `read:wedding:WED-${year}-`]);
  });
});
