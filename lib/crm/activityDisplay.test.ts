/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { activityView, type ActivityLike } from './activityDisplay';

const row = (over: Partial<ActivityLike>): ActivityLike => ({ type: 'STATUS_CHANGED', summary: '', detail: null, performedByName: null, aiGenerated: false, ...over });

describe('activityView — the stored sentence is the headline, the event code is audit-only', () => {
  test('quotation sent', () => {
    const v = activityView(row({ type: 'QUOTATION_SENT', summary: 'Quotation QTN-202609-0001 sent — total ₹5,00,000, advance ₹2,00,000, valid until 27 Sep 2026', performedByName: 'Gaurav' }));
    expect(v.headline).toBe('Quotation sent to customer');
    expect(v.body).toBe('QTN-202609-0001 · Total ₹5,00,000, advance ₹2,00,000, valid until 27 Sep 2026');
    expect(v.by).toBe('Gaurav');
    expect(v.auditCode).toBe('QUOTATION_SENT');
    expect(v.tone).toBe('key');
  });

  test('customer accepted — with how, and their words', () => {
    const v = activityView(row({ type: 'QUOTATION_ACCEPTED', summary: 'Quotation QTN-202609-0001 accepted by the customer via WhatsApp — total ₹5,00,000', detail: 'Yes, go ahead' }));
    expect(v.headline).toBe('Customer accepted the quotation');
    expect(v.body).toContain('recorded via WhatsApp');
    expect(v.body).toContain('“Yes, go ahead”');
    expect(v.headline).not.toContain('QUOTATION_ACCEPTED');
  });

  test('customer declined, with the reason', () => {
    const v = activityView(row({ type: 'QUOTATION_REJECTED', summary: 'Quotation QTN-1 rejected', detail: 'Too expensive' }));
    expect(v.headline).toBe('Customer declined the quotation');
    expect(v.body).toBe('Reason: Too expensive');
  });

  test('a stage change reads as a sentence', () => {
    const v = activityView(row({ summary: 'Stage changed: Site Visit Scheduled → Quotation Sent' }));
    expect(v.headline).toBe('Lead status changed from Site Visit Scheduled to Quotation Sent');
    expect(v.tone).toBe('plain');
  });

  test('closing a lead shows the reason in the operator’s words (from the lead, so "Customer cancelled" survives)', () => {
    const v = activityView(row({ summary: 'Stage changed: Quotation Sent → Lost', detail: 'OTHER' }), { lostReasonText: 'Customer cancelled' });
    expect(v.headline).toBe('Lead status changed from Quotation Sent to Lost');
    expect(v.body).toBe('Reason: Customer cancelled');
    expect(v.tone).toBe('stop');
  });

  test('without the lead’s own reason, a stored reason key is still translated', () => {
    const v = activityView(row({ summary: 'Stage changed: Quotation Sent → Lost', detail: 'BUDGET_ISSUE' }));
    expect(v.body).toBe('Reason: Budget issue');
  });

  test('assignment', () => {
    expect(activityView(row({ type: 'ASSIGNED', summary: 'Assigned to Gaurav' })).headline).toBe('Lead assigned to Gaurav');
    expect(activityView(row({ type: 'ASSIGNED', summary: 'Unassigned' })).headline).toBe('Lead unassigned');
  });

  test('a note is "Note from <person>" with the note as its body', () => {
    const v = activityView(row({ type: 'NOTE', summary: 'Called Priya', detail: 'Called Priya — evening muhurat', performedByName: 'Gaurav' }));
    expect(v.headline).toBe('Note from Gaurav');
    expect(v.body).toBe('Called Priya — evening muhurat');
    expect(v.tone).toBe('note');
  });

  test('a note without a recorded author is from the "Team", not "Automatic"', () => {
    expect(activityView(row({ type: 'NOTE', summary: 'x', detail: 'x' })).by).toBe('Team');
  });

  test('system rows say "Automatic", never "System"; AI rows say so', () => {
    expect(activityView(row({ summary: 'Anything' })).by).toBe('Automatic');
    expect(activityView(row({ summary: 'Anything', aiGenerated: true })).by).toBe('AI assistant');
  });

  test('an unrecognised row falls back to its stored sentence — never to the raw event type', () => {
    const v = activityView(row({ type: 'PAYMENT_RECEIVED', summary: 'Payment of ₹50,000 received', detail: null }));
    expect(v.headline).toBe('Payment of ₹50,000 received');
    expect(v.headline).not.toContain('PAYMENT_RECEIVED');
    expect(v.auditCode).toBe('PAYMENT_RECEIVED');
  });

  test('revisions read plainly', () => {
    const v = activityView(row({ type: 'QUOTATION_REVISED', summary: 'Quotation QTN-1 revised — new draft QTN-2 (revision 2)' }));
    expect(v.headline).toBe('Quotation revised');
    expect(v.body).toContain('QTN-2');
  });

  test('no headline is ever an UPPER_SNAKE event code', () => {
    const rows = [
      row({ type: 'QUOTATION_SENT', summary: 'Quotation Q1 sent — total ₹1' }),
      row({ type: 'QUOTATION_ACCEPTED', summary: 'Quotation Q1 accepted by the customer via Phone — total ₹1' }),
      row({ type: 'INVOICE_CREATED', summary: 'Advance invoice INV-1 created automatically from quotation Q1 — ₹1' }),
      row({ type: 'STATUS_CHANGED', summary: 'Stage changed: A → B' }),
    ];
    for (const r of rows) expect(activityView(r).headline).not.toMatch(/^[A-Z_]{6,}$/);
  });
});
