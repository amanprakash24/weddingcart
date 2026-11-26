import { auditAs } from '@/lib/finance/audit';
import type { Prisma } from '@/generated/prisma/client';
import { ActivityType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { allocate, indiaToday, scheduleBalance, validateSchedule, type InstalmentInput, type ScheduledStep } from '@/lib/money/schedule';
import { logMoney } from '@/services/agreement.service';

// Payment schedule (22 Nov 2026): staff split an agreement's balance into dated instalments.
//
// Rules, enforced here on every save, inside one transaction:
//   - the agreement must exist (the quotation was accepted and its booking terms frozen);
//   - the agreement row is locked, and the save must name the version it was edited from — a save made on an out-of-date screen is
//     refused (409) instead of silently overwriting someone else's newer schedule;
//   - the instalments add up to EXACTLY agreementTotal − confirmationAmount (lib/money/schedule.ts), positive whole rupees, real
//     dates in order — so the schedule always reconciles with the accepted quotation;
//   - the whole schedule is replaced (never merged), and the change is written to the money history with who made it.
// Nothing is sent to the couple from here; their My Wedding page reads the schedule when it loads.

type Tx = Prisma.TransactionClient;

const ymd = (d: Date) => d.toISOString().slice(0, 10); // @db.Date comes back as UTC midnight of that date
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const dayWords = (s: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${s}T00:00:00Z`));

export interface PaymentScheduleView {
  exists: boolean; // false = no agreement yet (quotation not accepted / not booked) — nothing can be scheduled
  version: number;
  agreementTotal: number;
  confirmationAmount: number;
  balance: number; // what the instalments must add up to
  received: number;
  instalments: { label: string; amount: number; dueDate: string }[];
  steps: ScheduledStep[]; // booking amount + instalments, with what is paid of each (money goes to the booking amount first)
}

// Credit notes on the agreement's invoices (money design v1, PR 7): the advance invoice's lower the booking amount, the balance
// invoice's lower what the instalments must add up to.
async function creditsFor(client: Tx | typeof prisma, quotationId: string): Promise<{ advance: number; balance: number }> {
  const rows = await client.invoice.findMany({ where: { quotationId, confirmationId: null, kind: { in: ['ADVANCE', 'BALANCE'] } }, select: { kind: true, creditedAmount: true } });
  return { advance: rows.filter((r) => r.kind === 'ADVANCE').reduce((s, r) => s + r.creditedAmount, 0), balance: rows.filter((r) => r.kind === 'BALANCE').reduce((s, r) => s + r.creditedAmount, 0) };
}

async function receivedFor(client: Tx | typeof prisma, quotationId: string): Promise<number> {
  // the same money the agreement counts: successful payments on its advance / balance invoices
  const payments = await client.payment.findMany({ where: { status: 'SUCCESS', invoice: { quotationId, confirmationId: null, kind: { in: ['ADVANCE', 'BALANCE'] } } }, select: { amount: true } });
  return payments.reduce((s, p) => s + p.amount, 0);
}

export const paymentScheduleService = {
  async get(quotationId: string, now: Date = new Date()): Promise<PaymentScheduleView> {
    const quotation = await prisma.quotation.findUnique({ where: { id: quotationId }, select: { id: true } });
    if (!quotation) throw new NotFoundError('Quotation', quotationId);
    const agreement = await prisma.commercialAgreement.findFirst({
      where: { confirmationId: null, quotationId },
      select: { agreementTotal: true, confirmationAmount: true, scheduleVersion: true, instalments: { orderBy: { sortOrder: 'asc' }, select: { label: true, amount: true, dueDate: true } } },
    });
    if (!agreement) return { exists: false, version: 0, agreementTotal: 0, confirmationAmount: 0, balance: 0, received: 0, instalments: [], steps: [] };
    const received = await receivedFor(prisma, quotationId);
    const credits = await creditsFor(prisma, quotationId);
    const instalments = agreement.instalments.map((i) => ({ label: i.label, amount: i.amount, dueDate: ymd(i.dueDate) }));
    const booking = Math.max(0, Math.min(agreement.confirmationAmount, agreement.agreementTotal) - credits.advance);
    const steps = allocate([...(booking > 0 ? [{ label: 'Booking amount', amount: booking, dueDate: null }] : []), ...instalments], received, indiaToday(now));
    return {
      exists: true,
      version: agreement.scheduleVersion,
      agreementTotal: agreement.agreementTotal,
      confirmationAmount: agreement.confirmationAmount,
      balance: Math.max(0, scheduleBalance(agreement.agreementTotal, agreement.confirmationAmount) - credits.balance),
      received,
      instalments,
      steps,
    };
  },

  async set(quotationId: string, input: { instalments: InstalmentInput[]; expectedVersion: number }, actorId: string | null): Promise<PaymentScheduleView> {
    await prisma.$transaction(async (tx) => {
      await auditAs(tx, actorId); // finance audit: who is acting (lib/finance/audit.ts)
      // Lock the agreement row: two saves at once are taken one after the other, and the second sees the first's version.
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "commercial_agreements" WHERE "quotationId" = ${quotationId} FOR UPDATE`;
      if (locked.length === 0) throw new ConflictError('There is no booking agreement for this quotation yet — accept the quotation and create the booking first');
      const agreement = await tx.commercialAgreement.findFirst({
        where: { confirmationId: null, quotationId },
        select: { id: true, agreementTotal: true, confirmationAmount: true, scheduleVersion: true, quotation: { select: { quotationNumber: true, leadId: true, enquiryId: true, consultationId: true } } },
      });
      if (!agreement) throw new ConflictError('There is no booking agreement for this quotation yet');
      if (agreement.scheduleVersion !== input.expectedVersion) {
        throw new ConflictError('Someone else changed this payment schedule while you were editing it. Reload to see their version, then make your change again.');
      }
      const items = input.instalments.map((i) => ({ label: i.label.trim(), amount: i.amount, dueDate: i.dueDate }));
      const balance = Math.max(0, scheduleBalance(agreement.agreementTotal, agreement.confirmationAmount) - (await creditsFor(tx, quotationId)).balance);
      const problems = validateSchedule(items, balance);
      if (problems.length > 0) throw new ValidationError(problems.map((p) => p.message).join('. '));

      await tx.paymentInstalment.deleteMany({ where: { agreementId: agreement.id } });
      if (items.length > 0) {
        await tx.paymentInstalment.createMany({
          data: items.map((i, index) => ({ agreementId: agreement.id, sortOrder: index + 1, label: i.label, amount: i.amount, dueDate: new Date(`${i.dueDate}T00:00:00Z`), createdById: actorId })),
        });
      }
      await tx.commercialAgreement.update({ where: { id: agreement.id }, data: { scheduleVersion: { increment: 1 } } });

      const wedding = await tx.invoice.findFirst({ where: { quotationId, weddingId: { not: null } }, select: { weddingId: true } });
      const summary =
        items.length === 0
          ? `Payment schedule cleared for ${agreement.quotation.quotationNumber} — the balance of ${rupees(balance)} has no dates`
          : `Payment schedule set for ${agreement.quotation.quotationNumber}: ${items.map((i) => `${i.label} ${rupees(i.amount)} by ${dayWords(i.dueDate)}`).join('; ')} (balance ${rupees(balance)})`;
      await logMoney(tx, agreement.quotation, wedding?.weddingId ?? null, summary, ActivityType.NOTE, actorId);
    });
    return this.get(quotationId);
  },
};
