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
  finance: {
    outstanding: number;
    duePayments: { id: string; clientName: string; invoiceNumber: string; amount: number; dueAt: string | null }[];
    recentPayments: { id: string; clientName: string; amount: number; method: string; paidAt: string }[];
  };
}

export const commandCenterService = {
  async getDashboard(now = new Date()): Promise<CommandCenter> {
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
      prisma.invoice.findMany({
        where: { status: { not: 'DRAFT' } },
        select: { total: true, amountPaid: true },
      }),
      prisma.invoice.findMany({
        where: { status: { notIn: ['DRAFT', 'PAID'] } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          clientName: true,
          invoiceNumber: true,
          total: true,
          amountPaid: true,
          paymentLinks: { where: { status: 'CREATED' }, orderBy: { expiresAt: 'asc' }, take: 1, select: { expiresAt: true } },
        },
      }),
      prisma.payment.findMany({
        where: { status: 'SUCCESS' },
        orderBy: { paidAt: 'desc' },
        take: 8,
        include: { invoice: { select: { clientName: true } } },
      }),
    ]);

    const stages = [
      { label: 'New enquiries', stages: ['NEW'] as PipelineStage[], count: pipelineCounts[0] },
      { label: 'Consultation', stages: ['QUALIFIED'] as PipelineStage[], count: pipelineCounts[1] },
      { label: 'Proposal', stages: ['QUOTATION_SENT'] as PipelineStage[], count: pipelineCounts[2] },
      { label: 'Negotiation', stages: ['NEGOTIATION'] as PipelineStage[], count: pipelineCounts[3] },
      { label: 'Confirmed booking', stages: ['WON'] as PipelineStage[], count: pipelineCounts[4] },
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
        paymentsDue: dueInvoices.filter((invoice) => invoice.total > invoice.amountPaid).length,
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
      finance: {
        outstanding: invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.total - invoice.amountPaid), 0),
        duePayments: dueInvoices
          .filter((invoice) => invoice.total > invoice.amountPaid)
          .map((invoice) => ({
            id: invoice.id,
            clientName: invoice.clientName,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.total - invoice.amountPaid,
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
