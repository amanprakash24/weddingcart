import { prisma } from '@/lib/prisma';
import type { PipelineStage } from '@/generated/prisma/client';

const OPEN_TASK_STATUSES = ['PENDING', 'IN_PROGRESS'] as const;

function startOfDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function dateValue(value: Date): string {
  return value.toISOString();
}

// `Invoice.amountPaid` is a Phase A stored column, only ever written at
// manual invoice create/update time. For wedding-linked invoices, the real
// Razorpay payment flow (payment.service.ts) never touches it, so it goes
// stale the moment a real partial payment comes in via a payment link — same
// fix as founderDashboard.service.ts's getRevenue() (Sprint 7.4): compute the
// paid amount live from successful Payment rows instead.
//
// Standalone invoices (weddingId: null — the legacy/admin `/api/invoices`
// path, still actively used by AdminClient.tsx) are the opposite case: no
// Razorpay payment-link route exists for them, so they never get a Payment
// row at all. `amountPaid` is their only source of truth, manually maintained
// and bounds-checked at write time (invoice.service.ts's create()/update()).
// Falling back to it here (rather than trusting Payment rows universally)
// avoids silently zeroing out a real, manually-recorded balance.
type InvoiceWithSuccessfulPayments = { total: number; amountPaid: number; creditedAmount: number; weddingId: string | null; payments: { amount: number }[] };
// What is settled on an invoice: payments plus credit notes (money design v1, PR 7) — what is still due is total minus this.
function paidAmount(invoice: InvoiceWithSuccessfulPayments): number {
  if (invoice.weddingId === null) return invoice.amountPaid;
  return invoice.payments.reduce((sum, payment) => sum + payment.amount, 0) + invoice.creditedAmount;
}

async function countPipeline(stage: PipelineStage): Promise<number> {
  const [leads, enquiries, consultations] = await Promise.all([
    prisma.lead.count({ where: { pipelineStage: stage } }),
    prisma.enquiry.count({ where: { pipelineStage: stage } }),
    prisma.consultation.count({ where: { pipelineStage: stage } }),
  ]);
  return leads + enquiries + consultations;
}

export interface CommandCenter {
  today: {
    newLeads: number;
    followUpsDue: number;
    tasksDue: number;
    upcomingEvents: number;
    paymentsDue: number;
    eventsToday: number;
  };
  pipeline: { label: string; stages: PipelineStage[]; count: number }[];
  upcomingEvents: {
    id: string;
    weddingId: string;
    name: string;
    type: string;
    date: string;
    location: string;
    guestCount: number | null;
    status: string;
    coordinator: string;
  }[];
  tasks: {
    overdue: number;
    dueToday: number;
    upcoming: number;
    items: { id: string; title: string; dueAt: string | null; priority: string; weddingId: string | null }[];
  };
  // Company-wide money: null unless the caller may see company financials (lib/auth/financialAccess.ts). The
  // `today.paymentsDue` count above stays for everyone — it is a work count, not an amount.
  finance: {
    outstanding: number;
    duePayments: { id: string; clientName: string; invoiceNumber: string; amount: number; dueAt: string | null }[];
    recentPayments: { id: string; clientName: string; amount: number; method: string; paidAt: string }[];
  } | null;
}

export interface CommandCenterOptions {
  // false = do not read or return company-wide money (the `finance` block is null). Defaults to true.
  includeFinancials?: boolean;
}

export const commandCenterService = {
  async getDashboard(now = new Date(), { includeFinancials = true }: CommandCenterOptions = {}): Promise<CommandCenter> {
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);
    const nextWeek = addDays(today, 8);
    const openTaskWhere = { status: { in: [...OPEN_TASK_STATUSES] }, dueAt: { not: null } };

    const [
      newLeads,
      followUpsDue,
      tasksDue,
      upcomingEventsCount,
      upcomingEvents,
      eventsToday,
      pipelineCounts,
      overdue,
      dueToday,
      upcoming,
      taskItems,
      invoices,
      dueInvoices,
      recentPayments,
    ] = await Promise.all([
      Promise.all([
        prisma.lead.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
        prisma.enquiry.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
        prisma.consultation.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      ]).then((counts) => counts.reduce((sum, count) => sum + count, 0)),
      prisma.task.count({
        where: { context: 'SALES_FOLLOWUP', ...openTaskWhere, dueAt: { gte: today, lt: tomorrow } },
      }),
      prisma.task.count({
        where: { context: 'WEDDING_TASK', ...openTaskWhere, dueAt: { gte: today, lt: tomorrow } },
      }),
      prisma.weddingEvent.count({ where: { date: { gte: today } } }),
      prisma.weddingEvent.findMany({
        where: { date: { gte: today } },
        orderBy: { date: 'asc' },
        take: 10,
        include: {
          wedding: {
            include: {
              couple: true,
              customer: { select: { name: true } },
              coordinator: { select: { name: true } },
            },
          },
        },
      }),
      prisma.weddingEvent.count({ where: { date: { gte: today, lt: tomorrow } } }),
      Promise.all([
        countPipeline('NEW'),
        countPipeline('QUALIFIED'),
        countPipeline('QUOTATION_SENT'),
        countPipeline('NEGOTIATION'),
        countPipeline('ACCEPTED'),
        countPipeline('WON'),
      ]),
      prisma.task.count({ where: { ...openTaskWhere, dueAt: { lt: now } } }),
      prisma.task.count({ where: { ...openTaskWhere, dueAt: { gte: today, lt: tomorrow } } }),
      prisma.task.count({ where: { ...openTaskWhere, dueAt: { gte: tomorrow, lt: nextWeek } } }),
      prisma.task.findMany({
        where: { ...openTaskWhere, dueAt: { lte: nextWeek } },
        orderBy: { dueAt: 'asc' },
        take: 12,
        select: { id: true, title: true, dueAt: true, priority: true, weddingId: true },
      }),
      includeFinancials
        ? prisma.invoice.findMany({
            where: { status: { not: 'DRAFT' }, voidedAt: null },
            select: {
              total: true,
              amountPaid: true,
              creditedAmount: true,
              weddingId: true,
              payments: { where: { status: 'SUCCESS' }, select: { amount: true } },
            },
          })
        : Promise.resolve([]),
      prisma.invoice.findMany({
        where: { status: { notIn: ['DRAFT', 'PAID'] }, voidedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          clientName: true,
          invoiceNumber: true,
          total: true,
          amountPaid: true,
          creditedAmount: true,
          weddingId: true,
          payments: { where: { status: 'SUCCESS' }, select: { amount: true } },
          paymentLinks: { where: { status: 'CREATED' }, orderBy: { expiresAt: 'asc' }, take: 1, select: { expiresAt: true } },
        },
      }),
      includeFinancials
        ? prisma.payment.findMany({
            where: { status: 'SUCCESS' },
            orderBy: { paidAt: 'desc' },
            take: 8,
            include: { invoice: { select: { clientName: true } } },
          })
        : Promise.resolve([]),
    ]);

    const stages = [
      { label: 'New enquiries', stages: ['NEW'] as PipelineStage[], count: pipelineCounts[0] },
      { label: 'Consultation', stages: ['QUALIFIED'] as PipelineStage[], count: pipelineCounts[1] },
      { label: 'Proposal', stages: ['QUOTATION_SENT'] as PipelineStage[], count: pipelineCounts[2] },
      { label: 'Negotiation', stages: ['NEGOTIATION'] as PipelineStage[], count: pipelineCounts[3] },
      { label: 'Accepted — booking pending', stages: ['ACCEPTED'] as PipelineStage[], count: pipelineCounts[4] },
      { label: 'Confirmed booking', stages: ['WON'] as PipelineStage[], count: pipelineCounts[5] },
    ];

    const events = upcomingEvents.map((event) => {
      const coupleName = [event.wedding.couple?.brideName, event.wedding.couple?.groomName].filter(Boolean).join(' & ');
      return {
        id: event.id,
        weddingId: event.weddingId,
        name: coupleName || event.wedding.customer?.name || event.wedding.weddingNumber,
        type: event.label || event.type,
        date: dateValue(event.date),
        location: event.venueName || event.venueAddress || event.city,
        guestCount: event.wedding.guestCount,
        status: event.wedding.status,
        coordinator: event.wedding.coordinator?.name || 'Unassigned',
      };
    });

    return {
      today: {
        newLeads,
        followUpsDue,
        tasksDue,
        upcomingEvents: upcomingEventsCount,
        paymentsDue: dueInvoices.filter((invoice) => invoice.total > paidAmount(invoice)).length,
        eventsToday,
      },
      pipeline: stages,
      upcomingEvents: events,
      tasks: {
        overdue,
        dueToday,
        upcoming,
        items: taskItems.map((task) => ({ ...task, dueAt: task.dueAt ? dateValue(task.dueAt) : null })),
      },
      finance: !includeFinancials ? null : {
        outstanding: invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.total - paidAmount(invoice)), 0),
        duePayments: dueInvoices
          .filter((invoice) => invoice.total > paidAmount(invoice))
          .map((invoice) => ({
            id: invoice.id,
            clientName: invoice.clientName,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.total - paidAmount(invoice),
            dueAt: invoice.paymentLinks[0]?.expiresAt ? dateValue(invoice.paymentLinks[0].expiresAt) : null,
          })),
        recentPayments: recentPayments.map((payment) => ({
          id: payment.id,
          clientName: payment.invoice.clientName,
          amount: payment.amount,
          method: payment.method,
          paidAt: dateValue(payment.paidAt),
        })),
      },
    };
  },
};
