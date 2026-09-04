import crypto from 'crypto';

// AES-256-GCM field-level encryption for sensitive data at rest — first use is
// VendorPaymentDetails.bankAccountNumber per docs/wedding-os/06-finance.md §3's
// "encrypt at rest" requirement. Keep all encrypt/decrypt logic in this one
// file; callers (repositories) should never construct ciphers themselves.
//
// The key is read from the environment on every call, not cached at module
// load, so tests can swap BANK_ACCOUNT_ENCRYPTION_KEY between cases without a
// module reset.

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // bytes — GCM-recommended nonce size
const VERSION_PREFIX = 'v1';

function getKey(): Buffer {
  const hex = process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error('BANK_ACCOUNT_ENCRYPTION_KEY is not set — cannot encrypt/decrypt sensitive fields');
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error('BANK_ACCOUNT_ENCRYPTION_KEY must be a 32-byte key encoded as a 64-character hex string');
  }
  return key;
}

// Stored shape: "v1:<iv>:<authTag>:<ciphertext>", each part base64 — a single
// string so it fits the existing `String?` column with no schema change.
export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [VERSION_PREFIX, iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptField(stored: string): string {
  const key = getKey();
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new Error('Value is not in the expected encrypted field format');
  }
  const [, ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

// Distinguishes already-encrypted values from legacy plaintext — used by the
// backfill script so it never double-encrypts an already-migrated row.
export function isEncryptedField(value: string): boolean {
  return value.startsWith(`${VERSION_PREFIX}:`) && value.split(':').length === 4;
}
