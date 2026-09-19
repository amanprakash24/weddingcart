// Race-safe, human-readable sequence numbers (QTN-YYYYMM-NNNN, and later INV-/WED-).
//
// The old scheme counted rows in the bucket and added one. That is wrong twice:
//  - two concurrent creates read the same count and collide on the unique number
//    (the loser's whole transaction fails); and
//  - deleting a row lowers the count, so the next number can duplicate an existing one.
//
// Here the next number is (highest existing number in the bucket) + 1, computed while
// holding a transaction-scoped advisory lock on the bucket, so concurrent callers are
// serialized and deletions can't cause duplicates. The unique index remains the backstop.
import type { Prisma } from '@/generated/prisma/client';

type Tx = Prisma.TransactionClient;

// e.g. monthBucket('QTN') -> "QTN-202609-"
export function monthBucket(prefix: string, now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${prefix}-${now.getFullYear()}${month}-`;
}

export function nextSequenceNumber(bucket: string, lastNumber: string | null, pad = 4): string {
  let next = 1;
  if (lastNumber !== null) {
    if (!lastNumber.startsWith(bucket)) {
      throw new Error(`Number ${lastNumber} is not in bucket ${bucket}`);
    }
    const suffix = lastNumber.slice(bucket.length);
    const parsed = Number(suffix);
    if (!/^\d+$/.test(suffix) || !Number.isSafeInteger(parsed)) {
      throw new Error(`Cannot read a sequence from ${lastNumber}`);
    }
    next = parsed + 1;
  }
  return `${bucket}${String(next).padStart(pad, '0')}`;
}

// Take this first inside the transaction that reads "the last number" and inserts the
// row. Released automatically at commit/rollback.
export async function lockNumberBucket(tx: Tx, bucket: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`number:${bucket}`}, 0))`;
}
