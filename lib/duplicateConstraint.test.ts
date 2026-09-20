/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { columnFromIndex, constraintFromMeta, friendlyDuplicateMessage } from './duplicateConstraint';

// The exact shape Prisma 7 + the pg adapter produced for a real unique violation (captured from staging).
const adapterMeta = (index: string) => ({
  driverAdapterError: { name: 'DriverAdapterError', cause: { originalCode: '23505', kind: 'UniqueConstraintViolation', constraint: { index }, table: 'x' } },
  modelName: 'X',
});

describe('constraintFromMeta', () => {
  test('reads the rule from the driver-adapter shape', () => {
    expect(constraintFromMeta(adapterMeta('invoices_invoiceNumber_key'))).toEqual({ index: 'invoices_invoiceNumber_key', fields: [] });
  });
  test('still understands the classic target array', () => {
    expect(constraintFromMeta({ target: ['slug'] })).toEqual({ index: null, fields: ['slug'] });
    expect(constraintFromMeta({ target: 'slug' })).toEqual({ index: null, fields: ['slug'] });
  });
  test('nothing usable → empty, never a crash', () => {
    for (const meta of [undefined, null, {}, 'x', { driverAdapterError: {} }]) {
      expect(constraintFromMeta(meta)).toEqual({ index: null, fields: [] });
    }
  });
});

describe('columnFromIndex', () => {
  test('a plain unique column', () => {
    expect(columnFromIndex('invoices_invoiceNumber_key')).toBe('invoiceNumber');
    expect(columnFromIndex('bookings_quotationId_key')).toBe('quotationId');
  });
  test('partial / expression indexes have no single column', () => {
    expect(columnFromIndex('quotations_one_open_per_source_key')).toBeNull();
    expect(columnFromIndex(null)).toBeNull();
  });
});

describe('friendlyDuplicateMessage — each quotation rule in plain words', () => {
  test.each([
    ['quotations_one_open_per_source_key', 'open quotation'],
    ['quotations_one_accepted_per_source_key', 'accepted quotation'],
    ['quotations_supersedesId_key', 'already has a revision'],
    ['quotations_quotationNumber_key', 'try again'],
    ['quotations_advanceInvoiceId_key', 'advance invoice was already created'],
    ['bookings_quotationId_key', 'booking was already created'],
  ])('%s', (index, words) => {
    const text = friendlyDuplicateMessage('Quotation', { index, fields: [] });
    expect(text).toContain(words);
    expect(text).not.toContain('this field');
    expect(text).not.toMatch(/_key|constraint/i);
  });

  test('another unique column names the column, not "field"', () => {
    expect(friendlyDuplicateMessage('Invoice', { index: 'invoices_invoiceNumber_key', fields: [] })).toBe('Invoice already exists with this invoiceNumber');
    expect(friendlyDuplicateMessage('Event', { index: null, fields: ['slug'] })).toBe('Event already exists with this slug');
  });

  test('an unknown rule still names the rule instead of saying "this field"', () => {
    expect(friendlyDuplicateMessage('Thing', { index: 'things_some_expr_idx', fields: [] })).toBe('Thing already exists (rule: things_some_expr_idx)');
  });

  test('with nothing known at all it falls back to the old sentence', () => {
    expect(friendlyDuplicateMessage('Thing', { index: null, fields: [] })).toBe('Thing already exists with this field');
  });
});
