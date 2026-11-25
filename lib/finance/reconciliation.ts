// The founder's reconciliation report (money design v1, PR 2, 25 Nov 2026). Pure: the checks only — services/reconciliation.service.ts
// loads the records. Read-only by design: a mismatch is LISTED with the record and both figures; nothing is ever corrected here.

import { moneyTotals, vendorTotals, type AssignmentMoney } from '@/lib/vendor/vendorMoney';

export type CheckStatus = 'ok' | 'warning' | 'error' | 'info';

export interface CheckItem {
  ref: string; // what a person looks for: INV-…, WED-… · vendor · function, a table name
  detail: string;
  expected?: string;
  actual?: string;
}

export interface Check {
  id: string;
  title: string;
  status: CheckStatus;
  items: CheckItem[];
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// ---- the couple's side ----

export interface InvoiceFact {
  number: string;
  status: string; // DRAFT / SENT / PARTIALLY_PAID / PAID
  total: number;
  storedAmountPaid: number; // Invoice.amountPaid — a legacy column; payments are the truth for wedding invoices
  successfulPayments: number; // sum of SUCCESS payments
  isWeddingInvoice: boolean;
}

export function expectedInvoiceStatus(total: number, paid: number, current: string): string {
  if (paid <= 0) return current === 'DRAFT' ? 'DRAFT' : 'SENT';
  return paid >= total ? 'PAID' : 'PARTIALLY_PAID';
}

export function invoiceChecks(invoices: InvoiceFact[]): Check[] {
  const status: CheckItem[] = [];
  const overpaid: CheckItem[] = [];
  const legacy: CheckItem[] = [];
  for (const i of invoices) {
    const want = expectedInvoiceStatus(i.total, i.successfulPayments, i.status);
    if (want !== i.status) status.push({ ref: i.number, detail: `${inr(i.successfulPayments)} received of ${inr(i.total)}`, expected: want, actual: i.status });
    if (i.successfulPayments > i.total) overpaid.push({ ref: i.number, detail: 'more received than the invoice total — a refund or another invoice is owed', expected: `≤ ${inr(i.total)}`, actual: inr(i.successfulPayments) });
    if (i.isWeddingInvoice && i.storedAmountPaid !== i.successfulPayments) legacy.push({ ref: i.number, detail: 'stored "amount paid" differs from the payments; the screens use the payments', expected: inr(i.successfulPayments), actual: inr(i.storedAmountPaid) });
  }
  return [
    { id: 'invoice-status', title: 'Invoice status matches the payments received', status: status.length ? 'error' : 'ok', items: status },
    { id: 'invoice-overpaid', title: 'No invoice has received more than its total', status: overpaid.length ? 'warning' : 'ok', items: overpaid },
    { id: 'invoice-legacy-amount-paid', title: 'Old "amount paid" column (not used on screens)', status: legacy.length ? 'info' : 'ok', items: legacy },
  ];
}

export interface AgreementFact {
  quotationNumber: string;
  agreementTotal: number;
  invoiceTotals: number[]; // its advance and balance invoices
  received: number; // successful payments on those invoices
}

export function agreementChecks(agreements: AgreementFact[]): Check[] {
  const sums: CheckItem[] = [];
  const over: CheckItem[] = [];
  for (const a of agreements) {
    const invoiced = a.invoiceTotals.reduce((s, t) => s + t, 0);
    // Only once the balance invoice exists do the invoices have to add up to the agreement; before that, less is expected.
    if (a.invoiceTotals.length >= 2 && invoiced !== a.agreementTotal) sums.push({ ref: a.quotationNumber, detail: 'advance + balance invoices', expected: inr(a.agreementTotal), actual: inr(invoiced) });
    if (a.invoiceTotals.length < 2 && invoiced > a.agreementTotal) sums.push({ ref: a.quotationNumber, detail: 'invoiced more than agreed', expected: `≤ ${inr(a.agreementTotal)}`, actual: inr(invoiced) });
    if (a.received > a.agreementTotal) over.push({ ref: a.quotationNumber, detail: 'more received than agreed', expected: `≤ ${inr(a.agreementTotal)}`, actual: inr(a.received) });
  }
  return [
    { id: 'agreement-invoices', title: 'Each agreement’s invoices add up to the agreed total', status: sums.length ? 'error' : 'ok', items: sums },
    { id: 'agreement-received', title: 'No agreement has received more than agreed', status: over.length ? 'warning' : 'ok', items: over },
  ];
}

// ---- the vendor's side ----

export interface AssignmentFact {
  ref: string; // WED-… · vendor · function
  vendorId: string;
  money: AssignmentMoney;
  hasPayout: boolean;
  ledgerEntries: number; // payments recorded one by one, not voided
}

export function vendorChecks(rows: AssignmentFact[]): Check[] {
  const overpaid: CheckItem[] = [];
  const owedBack: CheckItem[] = [];
  const both: CheckItem[] = [];
  const noRate: CheckItem[] = [];
  const sides: CheckItem[] = [];
  for (const r of rows) {
    const m = r.money;
    if (m.owed && m.remaining !== null && m.remaining < 0) overpaid.push({ ref: r.ref, detail: 'paid more than the vendor’s amount', expected: `≤ ${inr(m.net ?? 0)}`, actual: inr(m.paid) });
    if (!m.owed && m.paid > 0) owedBack.push({ ref: r.ref, detail: `${m.workStatus.toLowerCase()} work with money paid on it — owed back until settled`, actual: inr(m.paid) });
    if (r.hasPayout && r.ledgerEntries > 0) both.push({ ref: r.ref, detail: 'an old payout and payments recorded one by one on the same work — counted twice?' });
    if (m.owed && m.commission === null) noRate.push({ ref: r.ref, detail: 'no commission rate set up for this vendor’s category: what they are owed is unknown' });
  }
  // The same figures must come out of the team's calculation and the vendor's (they share one function; this proves it on real rows).
  const byVendor = new Map<string, AssignmentMoney[]>();
  for (const r of rows) byVendor.set(r.vendorId, [...(byVendor.get(r.vendorId) ?? []), r.money]);
  for (const [vendorId, list] of byVendor) {
    const team = moneyTotals(list);
    const vendor = vendorTotals(list);
    if (team.net !== vendor.payable || team.paid !== vendor.paid || team.remaining !== vendor.remaining) {
      sides.push({ ref: `vendor ${vendorId}`, detail: 'team and vendor screens disagree', expected: `team: ${team.net} / ${team.paid} / ${team.remaining}`, actual: `vendor: ${vendor.payable} / ${vendor.paid} / ${vendor.remaining}` });
    }
  }
  return [
    { id: 'vendor-overpaid', title: 'No vendor is paid more than their amount', status: overpaid.length ? 'error' : 'ok', items: overpaid },
    { id: 'vendor-owed-back', title: 'Money paid on cancelled or declined work', status: owedBack.length ? 'warning' : 'ok', items: owedBack },
    { id: 'vendor-payout-and-ledger', title: 'No work uses both the old payout and recorded payments', status: both.length ? 'error' : 'ok', items: both },
    { id: 'vendor-no-rate', title: 'Every owed work has a commission rate', status: noRate.length ? 'warning' : 'ok', items: noRate },
    { id: 'vendor-sides-agree', title: 'Team and vendor screens show the same figures', status: sides.length ? 'error' : 'ok', items: sides },
  ];
}

// ---- the audit log ----

export function auditChecks(unattributed: { tableName: string; count: number }[], days: number): Check[] {
  const items = unattributed.filter((u) => u.count > 0).map((u) => ({ ref: u.tableName, detail: `${u.count} change${u.count === 1 ? '' : 's'} in the last ${days} days with no person recorded` }));
  return [{ id: 'audit-unattributed', title: `Every money change in the last ${days} days names who made it`, status: items.length ? 'info' : 'ok', items }];
}
