/// <reference types="bun-types" />
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { encryptField, decryptField, isEncryptedField } from './encryption';

const TEST_KEY = 'a'.repeat(64); // 32 bytes, hex-encoded
const originalKey = process.env.BANK_ACCOUNT_ENCRYPTION_KEY;

describe('field encryption', () => {
  beforeEach(() => {
    process.env.BANK_ACCOUNT_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
    else process.env.BANK_ACCOUNT_ENCRYPTION_KEY = originalKey;
  });

  test('round-trips plaintext through encrypt then decrypt', () => {
    const plaintext = '123456789012';
    const ciphertext = encryptField(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decryptField(ciphertext)).toBe(plaintext);
  });

  test('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = encryptField('same-value');
    const b = encryptField('same-value');
    expect(a).not.toBe(b);
  });

  test('isEncryptedField recognizes encrypted values and rejects plaintext', () => {
    const ciphertext = encryptField('some-account-number');
    expect(isEncryptedField(ciphertext)).toBe(true);
    expect(isEncryptedField('some-account-number')).toBe(false);
  });

  test('decryptField throws on a tampered ciphertext', () => {
    const ciphertext = encryptField('123456789012');
    const parts = ciphertext.split(':');
    parts[3] = parts[3].slice(0, -1) + (parts[3].endsWith('A') ? 'B' : 'A');
    expect(() => decryptField(parts.join(':'))).toThrow();
  });

  test('decryptField throws on a malformed (non-encrypted) value', () => {
    expect(() => decryptField('not-an-encrypted-value')).toThrow();
  });

  test('encryptField throws when the key is missing', () => {
    delete process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
    expect(() => encryptField('123456789012')).toThrow(/BANK_ACCOUNT_ENCRYPTION_KEY/);
  });

  test('decryptField throws when the key is missing', () => {
    const ciphertext = encryptField('123456789012');
    delete process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
    expect(() => decryptField(ciphertext)).toThrow(/BANK_ACCOUNT_ENCRYPTION_KEY/);
  });

  test('decryptField throws when decrypted with the wrong key', () => {
    const ciphertext = encryptField('123456789012');
    process.env.BANK_ACCOUNT_ENCRYPTION_KEY = 'b'.repeat(64);
    expect(() => decryptField(ciphertext)).toThrow();
  });
});
