// Race-safe INV-YYYYMM-NNNN and WED-YYYY-NNNN generators (built on lib/numbering.ts).
//
// The previous generators counted the rows in the bucket and added one. That is wrong in two ways:
//  - two transactions running at once read the same count and both insert the same number — the
//    loser's whole transaction fails on the unique index; and
//  - deleting a row lowers the count, so the next number can duplicate an existing one.
//
// This mattered little while invoices/weddings were created one at a time. Once the advance invoice is
// created INSIDE the booking → wedding conversion transaction (docs/wedding-os/08-quotation.md §6.6), two
// different weddings converting at the same moment would collide and one conversion would fail. So the
// next number is (highest existing in the bucket) + 1, taken under a transaction-scoped advisory lock on the
// bucket; the unique index remains the backstop.
//
// Known limit, inherited from the format: within one bucket the "highest" is found by text order, which is
// correct up to 9,999 numbers per bucket (per month for invoices, per year for weddings).
import type { Prisma } from '@/generated/prisma/client';
import { lockNumberBucket, monthBucket, nextSequenceNumber, yearBucket } from '@/lib/numbering';

type Tx = Prisma.TransactionClient;

// INV-YYYYMM-NNNN, sequential within the month — the same format already live in the database.
export async function generateInvoiceNumber(tx: Tx): Promise<string> {
  const bucket = monthBucket('INV');
  await lockNumberBucket(tx, bucket);
  const [last] = await tx.invoice.findMany({
    where: { invoiceNumber: { startsWith: bucket } },
    orderBy: { invoiceNumber: 'desc' },
    take: 1,
    select: { invoiceNumber: true },
  });
  return nextSequenceNumber(bucket, last?.invoiceNumber ?? null);
}

// WED-YYYY-NNNN, sequential within the year.
export async function generateWeddingNumber(tx: Tx): Promise<string> {
  const bucket = yearBucket('WED');
  await lockNumberBucket(tx, bucket);
  const [last] = await tx.wedding.findMany({
    where: { weddingNumber: { startsWith: bucket } },
    orderBy: { weddingNumber: 'desc' },
    take: 1,
    select: { weddingNumber: true },
  });
  return nextSequenceNumber(bucket, last?.weddingNumber ?? null);
}
