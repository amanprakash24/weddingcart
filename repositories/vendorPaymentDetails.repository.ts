import { prisma } from '@/lib/prisma';
import { Prisma, type VendorPaymentDetails } from '@/generated/prisma/client';
import { withPrismaErrors } from '@/lib/errors';
import { encryptField, decryptField } from '@/lib/crypto/encryption';

type Tx = Prisma.TransactionClient;

export interface VendorPaymentDetailsInput {
  accountHolderName?: string | null;
  bankAccountNumber?: string | null;
  ifscCode?: string | null;
  upiId?: string | null;
  gstin?: string | null;
}

function decrypted(row: VendorPaymentDetails): VendorPaymentDetails {
  return {
    ...row,
    bankAccountNumber: row.bankAccountNumber ? decryptField(row.bankAccountNumber) : row.bankAccountNumber,
  };
}

// bankAccountNumber is encrypted at rest (AES-256-GCM, lib/crypto/encryption.ts)
// per docs/wedding-os/06-finance.md §3. This repository is the single
// enforcement point: every caller gets/gives plaintext, the DB only ever
// stores ciphertext — encryption never happens (or gets forgotten) elsewhere.
// Domain shape is findByVendorId/upsert rather than the base id-keyed
// interface, since this is an optional 1:1 keyed on vendorId and callers
// never have this row's own id.
export const vendorPaymentDetailsRepository = {
  async findByVendorId(vendorId: string, tx: Tx | typeof prisma = prisma): Promise<VendorPaymentDetails | null> {
    const row = await tx.vendorPaymentDetails.findUnique({ where: { vendorId } });
    return row ? decrypted(row) : null;
  },

  async upsert(
    vendorId: string,
    data: VendorPaymentDetailsInput,
    tx: Tx | typeof prisma = prisma
  ): Promise<VendorPaymentDetails> {
    // undefined = field not being set this call (leave column untouched);
    // null = caller explicitly clearing it (store null, nothing to encrypt).
    const bankAccountNumber =
      data.bankAccountNumber != null ? encryptField(data.bankAccountNumber) : data.bankAccountNumber;

    const row = await withPrismaErrors('VendorPaymentDetails', () =>
      tx.vendorPaymentDetails.upsert({
        where: { vendorId },
        create: { vendor: { connect: { id: vendorId } }, ...data, bankAccountNumber },
        update: { ...data, bankAccountNumber },
      })
    );
    return decrypted(row);
  },
};
