/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { decideAdvanceInvoice, planAdvanceInvoice } from './advanceInvoice';

const accepted = { status: 'ACCEPTED' as const, advanceAmount: 200000, advanceInvoiceId: null };

describe('decideAdvanceInvoice — when does an accepted quotation produce an advance invoice?', () => {
  test('an ACCEPTED quotation with an advance and no invoice yet creates one', () => {
    expect(decideAdvanceInvoice(accepted)).toEqual({ action: 'CREATE' });
  });

  test('no quotation → skip', () => {
    expect(decideAdvanceInvoice(null)).toEqual({ action: 'SKIP', reason: 'NO_QUOTATION' });
    expect(decideAdvanceInvoice(undefined)).toEqual({ action: 'SKIP', reason: 'NO_QUOTATION' });
  });

  test.each(['DRAFT', 'SENT', 'REJECTED', 'EXPIRED', 'SUPERSEDED'] as const)('a %s quotation never produces an invoice', (status) => {
    expect(decideAdvanceInvoice({ ...accepted, status })).toEqual({ action: 'SKIP', reason: 'NOT_ACCEPTED' });
  });

  test('a zero advance means nothing to invoice', () => {
    expect(decideAdvanceInvoice({ ...accepted, advanceAmount: 0 })).toEqual({ action: 'SKIP', reason: 'NO_ADVANCE' });
  });

  test('an existing advanceInvoiceId means it was already created — the idempotency rule (retry or race)', () => {
    expect(decideAdvanceInvoice({ ...accepted, advanceInvoiceId: 'inv-1' })).toEqual({ action: 'SKIP', reason: 'ALREADY_CREATED' });
  });

  test('"already created" outranks "no advance" so a finished job is never re-examined', () => {
    expect(decideAdvanceInvoice({ ...accepted, advanceAmount: 0, advanceInvoiceId: 'inv-1' })).toEqual({ action: 'SKIP', reason: 'ALREADY_CREATED' });
  });
});

describe('planAdvanceInvoice — what the automatic invoice looks like', () => {
  const input = {
    quotation: { quotationNumber: 'QTN-202609-0007', total: 730000, advanceAmount: 200000 },
    wedding: { primaryDate: new Date('2026-12-05T00:00:00Z'), weddingType: 'wedding' },
    client: { name: 'Rahul Sharma', phone: '9876543210', email: 'rahul@example.com', city: 'Patna' },
  };

  test('one line for exactly the advance, total = advance', () => {
    const plan = planAdvanceInvoice(input);
    expect(plan.items).toEqual([{ description: 'Advance — QTN-202609-0007', amount: 200000, quantity: 1 }]);
    expect(plan.invoice.subtotal).toBe(200000);
    expect(plan.invoice.total).toBe(200000);
    expect(plan.invoice.discount).toBe(0);
  });

  test('NO TAX in V1 (decision Q4): tax is off and zero — nothing about GST is invented', () => {
    const plan = planAdvanceInvoice(input);
    expect(plan.invoice.gstEnabled).toBe(false);
    expect(plan.invoice.gstAmount).toBe(0);
    expect(plan.invoice.notes).toContain('No tax applied');
    // even when the QUOTATION itself carried tax, the advance invoice does not
    expect(plan.invoice.total).toBe(plan.invoice.subtotal);
  });

  test('is addressed to the client and carries the event date and type', () => {
    const { invoice } = planAdvanceInvoice(input);
    expect(invoice).toMatchObject({
      clientName: 'Rahul Sharma',
      clientPhone: '9876543210',
      clientEmail: 'rahul@example.com',
      clientCity: 'Patna',
      eventDate: '2026-12-05',
      eventType: 'wedding',
    });
  });

  test('the note names the quotation and its full total, so the invoice is traceable', () => {
    const { invoice } = planAdvanceInvoice(input);
    expect(invoice.notes).toBe('Advance against quotation QTN-202609-0007 (quotation total ₹7,30,000). No tax applied.');
  });

  test('blank optional client fields become null, not empty strings', () => {
    const { invoice } = planAdvanceInvoice({ ...input, client: { name: 'A', phone: '9', email: '  ', city: null } });
    expect(invoice.clientEmail).toBeNull();
    expect(invoice.clientCity).toBeNull();
    expect(planAdvanceInvoice({ ...input, wedding: { ...input.wedding, weddingType: null } }).invoice.eventType).toBeNull();
  });
});
