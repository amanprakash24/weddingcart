import { describe, expect, test } from 'bun:test';
import { agreementChecks, auditChecks, expectedInvoiceStatus, invoiceChecks, vendorChecks } from './reconciliation';
import { assignmentMoney, type AssignmentFacts } from '@/lib/vendor/vendorMoney';

const byId = <T extends { id: string }>(list: T[], id: string) => list.find((c) => c.id === id)!;

describe('invoices', () => {
  test('expected status from what was received', () => {
    expect(expectedInvoiceStatus(1000, 0, 'DRAFT')).toBe('DRAFT');
    expect(expectedInvoiceStatus(1000, 0, 'SENT')).toBe('SENT');
    expect(expectedInvoiceStatus(1000, 0, 'PAID')).toBe('SENT'); // paid with nothing received is wrong
    expect(expectedInvoiceStatus(1000, 400, 'SENT')).toBe('PARTIALLY_PAID');
    expect(expectedInvoiceStatus(1000, 1000, 'PARTIALLY_PAID')).toBe('PAID');
  });

  test('WED-2026-0002 as it stands: statuses agree; the old amount-paid column is only a note', () => {
    const checks = invoiceChecks([
      { number: 'INV-202611-0001', status: 'PAID', total: 21375, storedAmountPaid: 0, successfulPayments: 21375, isWeddingInvoice: true },
      { number: 'INV-202611-0002', status: 'PARTIALLY_PAID', total: 64125, storedAmountPaid: 0, successfulPayments: 10000, isWeddingInvoice: true },
    ]);
    expect(byId(checks, 'invoice-status')).toMatchObject({ status: 'ok', items: [] });
    expect(byId(checks, 'invoice-overpaid').status).toBe('ok');
    expect(byId(checks, 'invoice-legacy-amount-paid')).toMatchObject({ status: 'info' });
    expect(byId(checks, 'invoice-legacy-amount-paid').items).toHaveLength(2);
  });

  test('a wrong status and an overpayment are listed with both figures', () => {
    const checks = invoiceChecks([{ number: 'INV-1', status: 'SENT', total: 1000, storedAmountPaid: 1200, successfulPayments: 1200, isWeddingInvoice: true }]);
    expect(byId(checks, 'invoice-status')).toMatchObject({ status: 'error', items: [{ ref: 'INV-1', expected: 'PAID', actual: 'SENT' }] });
    expect(byId(checks, 'invoice-overpaid')).toMatchObject({ status: 'warning', items: [{ ref: 'INV-1', actual: '₹1,200' }] });
  });
});

describe('agreements', () => {
  test('advance + balance must add up to the agreement once both exist; never more received than agreed', () => {
    const ok = agreementChecks([{ quotationNumber: 'QTN-5', agreementTotal: 85500, invoiceTotals: [21375, 64125], received: 31375 }]);
    expect(ok.every((c) => c.status === 'ok')).toBe(true);
    const onlyAdvance = agreementChecks([{ quotationNumber: 'QTN-6', agreementTotal: 85500, invoiceTotals: [21375], received: 21375 }]);
    expect(onlyAdvance.every((c) => c.status === 'ok')).toBe(true);
    const bad = agreementChecks([{ quotationNumber: 'QTN-7', agreementTotal: 85500, invoiceTotals: [21375, 64000], received: 90000 }]);
    expect(byId(bad, 'agreement-invoices')).toMatchObject({ status: 'error', items: [{ ref: 'QTN-7', expected: '₹85,500', actual: '₹85,375' }] });
    expect(byId(bad, 'agreement-received').status).toBe('warning');
  });
});

describe('vendor money', () => {
  const facts = (over: Partial<AssignmentFacts> = {}): AssignmentFacts => ({ id: 'w', status: 'CONFIRMED', venueStatus: 'PENDING', agreedPrice: 10000, currentRate: 10, payout: null, payments: [], ...over });
  const row = (ref: string, over: Partial<AssignmentFacts> = {}, extra: { hasPayout?: boolean; ledgerEntries?: number } = {}) => ({ ref, vendorId: 'v1', money: assignmentMoney(facts(over)), hasPayout: extra.hasPayout ?? false, ledgerEntries: extra.ledgerEntries ?? 0 });

  test('clean rows: every check passes, and the team and vendor figures agree', () => {
    const checks = vendorChecks([row('A'), row('B', { payments: [{ amount: 3000, voided: false }] }, { ledgerEntries: 1 })]);
    expect(checks.every((c) => c.status === 'ok')).toBe(true);
  });

  test('overpaid, paid on cancelled work, payout + ledger together, no rate', () => {
    const checks = vendorChecks([
      row('over', { payments: [{ amount: 9500, voided: false }] }, { ledgerEntries: 1 }),
      row('cancelled', { status: 'CANCELLED', payments: [{ amount: 2000, voided: false }] }, { ledgerEntries: 1 }),
      row('both', { status: 'COMPLETED', payout: { status: 'PAID', commissionRate: 10, commissionAmount: 1000, netAmount: 9000 } }, { hasPayout: true, ledgerEntries: 1 }),
      row('norate', { currentRate: null }),
    ]);
    expect(byId(checks, 'vendor-overpaid')).toMatchObject({ status: 'error', items: [{ ref: 'over' }] });
    expect(byId(checks, 'vendor-owed-back')).toMatchObject({ status: 'warning', items: [{ ref: 'cancelled', actual: '₹2,000' }] });
    expect(byId(checks, 'vendor-payout-and-ledger')).toMatchObject({ status: 'error', items: [{ ref: 'both' }] });
    expect(byId(checks, 'vendor-no-rate')).toMatchObject({ status: 'warning', items: [{ ref: 'norate' }] });
  });
});

describe('audit log', () => {
  test('unattributed changes are a note, by table', () => {
    expect(auditChecks([{ tableName: 'quotations', count: 4 }, { tableName: 'payments', count: 0 }], 30)).toEqual([
      { id: 'audit-unattributed', title: 'Every money change in the last 30 days names who made it', status: 'info', items: [{ ref: 'quotations', detail: '4 changes in the last 30 days with no person recorded' }] },
    ]);
    expect(auditChecks([], 30)[0].status).toBe('ok');
  });
});

describe('credit notes and cancelled invoices (PR 7)', () => {
  const base = { number: 'INV-T', status: 'PAID', total: 10000, storedAmountPaid: 0, isWeddingInvoice: true };
  const byId = (checks: ReturnType<typeof invoiceChecks>) => Object.fromEntries(checks.map((c) => [c.id, c]));
  test('a credit settles the invoice with the payments; credits must match their notes; a refund owed is a warning', () => {
    expect(expectedInvoiceStatus(10000, 8000, 'PARTIALLY_PAID', 2000)).toBe('PAID');
    const ok = byId(invoiceChecks([{ ...base, storedAmountPaid: 8000, successfulPayments: 8000, credited: 2000, creditNotesTotal: 2000 }]));
    expect(ok['invoice-status'].items).toEqual([]);
    expect(ok['invoice-credits'].items).toEqual([]);
    const off = byId(invoiceChecks([{ ...base, storedAmountPaid: 10000, successfulPayments: 10000, credited: 1500, creditNotesTotal: 1000 }]));
    expect(off['invoice-credits'].status).toBe('error');
    expect(off['invoice-overpaid'].items[0].detail).toContain('₹1,500 is owed back');
  });
  test('a cancelled invoice skips the status check and must have no payment', () => {
    const v = byId(invoiceChecks([{ ...base, status: 'SENT', successfulPayments: 500, voided: true }]));
    expect(v['invoice-void'].status).toBe('error');
    expect(v['invoice-status'].items).toEqual([]);
  });
});
