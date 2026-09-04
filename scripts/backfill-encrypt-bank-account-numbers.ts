// bun run scripts/backfill-encrypt-bank-account-numbers.ts
//
// One-time (but safely re-runnable) backfill: encrypts any legacy plaintext
// VendorPaymentDetails.bankAccountNumber values still in the DB, per
// docs/wedding-os/06-finance.md §3's "encrypt at rest" requirement.
// Idempotent — skips rows already in the v1:... encrypted format (see
// lib/crypto/encryption.ts's isEncryptedField), so safe to run again after a
// partial failure or on a DB where encryption is already fully rolled out.
//
// Run via `bun`, not plain `node` — deliberately, unlike this repo's other
// .mjs scripts. Bun resolves the `@/` path aliases and the generated Prisma
// client natively, so this script reuses the real lib/crypto/encryption.ts
// instead of reimplementing AES-GCM a second time — encryption logic must
// stay in exactly one place.
//
// Never logs the plaintext or ciphertext values, only counts.
import { prisma } from '@/lib/prisma';
import { encryptField, isEncryptedField } from '@/lib/crypto/encryption';

async function main() {
  const rows = await prisma.vendorPaymentDetails.findMany({
    where: { bankAccountNumber: { not: null } },
    select: { id: true, bankAccountNumber: true },
  });

  let encrypted = 0;
  let skipped = 0;
  for (const row of rows) {
    const value = row.bankAccountNumber!;
    if (isEncryptedField(value)) {
      skipped++;
      continue;
    }
    await prisma.vendorPaymentDetails.update({
      where: { id: row.id },
      data: { bankAccountNumber: encryptField(value) },
    });
    encrypted++;
  }

  console.log(`Backfill complete: ${rows.length} row(s) checked, ${encrypted} encrypted, ${skipped} already encrypted.`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
