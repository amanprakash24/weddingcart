import { prisma } from '@/lib/prisma';
import { PLATFORM_BUSINESS_ID } from '@/lib/ownership/owned';
import { agreementChecks, auditChecks, invoiceChecks, vendorChecks, type Check } from '@/lib/finance/reconciliation';
import { vendorPaymentService } from '@/services/vendorPayment.service';

// The founder's reconciliation report (money design v1, PR 2, 25 Nov 2026). Read-only: loads the records and runs the checks in
// lib/finance/reconciliation.ts. Shaadi Shopping's own money only (the route runs platform-scoped); a venue's own business on Vivah OS
// is not part of it. Nothing here writes, corrects or back-fills anything.

const AUDIT_DAYS = 30;

export interface ReconciliationReport {
  generatedAt: string;
  counts: { invoices: number; agreements: number; assignments: number; auditEvents: number };
  checks: Check[];
}

export const reconciliationService = {
  async report(now: Date = new Date()): Promise<ReconciliationReport> {
    const since = new Date(now.getTime() - AUDIT_DAYS * 86_400_000);
    const [invoices, agreements, assignments, unattributed, auditEvents] = await Promise.all([
      prisma.invoice.findMany({ select: { invoiceNumber: true, status: true, total: true, amountPaid: true, weddingId: true, payments: { where: { status: 'SUCCESS' }, select: { amount: true } } } }),
      prisma.commercialAgreement.findMany({
        select: {
          agreementTotal: true,
          quotation: { select: { quotationNumber: true, invoices: { where: { kind: { in: ['ADVANCE', 'BALANCE'] } }, select: { total: true, payments: { where: { status: 'SUCCESS' }, select: { amount: true } } } } } },
        },
      }),
      vendorPaymentService.reconciliationRows(),
      prisma.financeEvent.groupBy({
        by: ['tableName'],
        where: { at: { gte: since }, actorId: null, OR: [{ businessId: PLATFORM_BUSINESS_ID }, { businessId: null }] },
        _count: { _all: true },
      }),
      prisma.financeEvent.count({ where: { at: { gte: since }, OR: [{ businessId: PLATFORM_BUSINESS_ID }, { businessId: null }] } }),
    ]);
    const sum = (ps: { amount: number }[]) => ps.reduce((s, p) => s + p.amount, 0);
    const checks: Check[] = [
      ...invoiceChecks(invoices.map((i) => ({ number: i.invoiceNumber, status: i.status, total: i.total, storedAmountPaid: i.amountPaid, successfulPayments: sum(i.payments), isWeddingInvoice: i.weddingId !== null }))),
      ...agreementChecks(agreements.map((a) => ({ quotationNumber: a.quotation.quotationNumber, agreementTotal: a.agreementTotal, invoiceTotals: a.quotation.invoices.map((i) => i.total), received: a.quotation.invoices.reduce((s, i) => s + sum(i.payments), 0) }))),
      ...vendorChecks(assignments),
      ...auditChecks(unattributed.map((u) => ({ tableName: u.tableName, count: u._count._all })), AUDIT_DAYS),
    ];
    return { generatedAt: now.toISOString(), counts: { invoices: invoices.length, agreements: agreements.length, assignments: assignments.length, auditEvents }, checks };
  },
};
