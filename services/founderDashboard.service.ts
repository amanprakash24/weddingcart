import { prisma } from '@/lib/prisma';
import type { PipelineStage } from '@/generated/prisma/enums';
import { commandCenterService, type CommandCenter } from '@/services/commandCenter.service';

// Sprint 5.4 — Founder Dashboard. Today's Work stays on the existing
// leadInboxService.stats()/`/api/crm/stats` (Sprint 5.1, unchanged); this
// service is purely additive, one aggregate read per docs/wedding-os/
// 01-command-center.md §4.1's already-resolved sourcing, composing 6
// independent, individually empty-safe queries.

export interface FounderDashboard {
  commandCenter: CommandCenter;
  revenue: {
    outstanding: number;
    totalCollected: number;
    invoicedThisMonth: { count: number; total: number };
    paymentsToday: number;
  };
  commission: { confirmed: number; pendingWeddings: number };
  pipelineHealth: { newThisWeek: number; convertedThisWeek: number; lostThisWeek: number; onHold: number };
  velocity: { stage: PipelineStage; avgDays: number | null; sampleSize: number }[];
  vendorAvailability: { date: string; categories: { category: string; counts: Record<string, number> }[] };
  followUpHealth: { dueToday: number; overdue: number; completedToday: number };
  teamPerformance: { userId: string | null; name: string; open: number; wonThisMonth: number; lostThisMonth: number }[];
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay()); // Sunday start
  return x;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Shared where-shape across Lead/Enquiry/Consultation (fields with identical
// names/semantics on all three, per the Phase B "additive to all three
// identically" pattern) — a real generic type, not a narrowed-then-cast one.
interface SubjectCountWhere {
  createdAt?: { gte?: Date; lt?: Date };
  assignedToId?: string | null;
  pipelineStage?: PipelineStage | { notIn: PipelineStage[] };
  updatedAt?: { gte?: Date; lt?: Date };
}

async function countAcrossAll(where: SubjectCountWhere): Promise<number> {
  const [leads, enquiries, consultations] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.enquiry.count({ where }),
    prisma.consultation.count({ where }),
  ]);
  return leads + enquiries + consultations;
}

async function getRevenue(): Promise<FounderDashboard['revenue']> {
  const now = new Date();
  const [outstandingAgg, collectedAgg, monthAgg, paymentsTodayAgg] = await Promise.all([
    prisma.invoice.aggregate({ where: { status: { notIn: ['DRAFT', 'PAID'] } }, _sum: { total: true, amountPaid: true } }),
    prisma.invoice.aggregate({ where: { status: { not: 'DRAFT' } }, _sum: { amountPaid: true } }),
    prisma.invoice.aggregate({
      where: { status: { not: 'DRAFT' }, createdAt: { gte: startOfMonth(now) } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.payment.aggregate({ where: { paidAt: { gte: startOfDay(now) }, status: 'SUCCESS' }, _sum: { amount: true } }),
  ]);

  return {
    outstanding: (outstandingAgg._sum.total ?? 0) - (outstandingAgg._sum.amountPaid ?? 0),
    totalCollected: collectedAgg._sum.amountPaid ?? 0,
    invoicedThisMonth: { count: monthAgg._count, total: monthAgg._sum.total ?? 0 },
    paymentsToday: paymentsTodayAgg._sum.amount ?? 0,
  };
}

async function getCommission(): Promise<FounderDashboard['commission']> {
  const [payoutAgg, pendingWeddings] = await Promise.all([
    prisma.payout.aggregate({ where: { status: 'PAID' }, _sum: { commissionAmount: true } }),
    prisma.wedding.count({ where: { status: { not: 'COMPLETED' } } }),
  ]);
  return { confirmed: payoutAgg._sum.commissionAmount ?? 0, pendingWeddings };
}

async function getPipelineHealth(): Promise<FounderDashboard['pipelineHealth']> {
  const weekStart = startOfWeek(new Date());
  const [newThisWeek, convertedThisWeek, lostThisWeek, onHold] = await Promise.all([
    countAcrossAll({ createdAt: { gte: weekStart } }),
    prisma.activityLog.count({ where: { toStage: 'WON', createdAt: { gte: weekStart } } }),
    prisma.activityLog.count({ where: { toStage: 'LOST', createdAt: { gte: weekStart } } }),
    countAcrossAll({ pipelineStage: 'ON_HOLD' }),
  ]);
  return { newThisWeek, convertedThisWeek, lostThisWeek, onHold };
}

const ACTIVE_STAGES: PipelineStage[] = [
  'NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT_SCHEDULED', 'QUOTATION_SENT', 'NEGOTIATION', 'ON_HOLD',
];

// Average days a subject spends in `fromStage` before its next transition —
// a real per-subject sequential computation (not a single SQL aggregate),
// per the Sprint 5.4 plan. 0 samples is the expected, honest result today
// (no real transitions recorded on staging yet).
async function getVelocity(): Promise<FounderDashboard['velocity']> {
  const transitions = await prisma.activityLog.findMany({
    where: { type: 'STATUS_CHANGED', fromStage: { not: null } },
    select: { leadId: true, enquiryId: true, consultationId: true, fromStage: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  if (transitions.length === 0) {
    return ACTIVE_STAGES.map((stage) => ({ stage, avgDays: null, sampleSize: 0 }));
  }

  const subjectKey = (t: (typeof transitions)[number]): string =>
    t.leadId ? `LEAD:${t.leadId}` : t.enquiryId ? `ENQUIRY:${t.enquiryId}` : `CONSULTATION:${t.consultationId}`;

  const leadIds = [...new Set(transitions.filter((t) => t.leadId).map((t) => t.leadId!))];
  const enquiryIds = [...new Set(transitions.filter((t) => t.enquiryId).map((t) => t.enquiryId!))];
  const consultationIds = [...new Set(transitions.filter((t) => t.consultationId).map((t) => t.consultationId!))];

  const [leads, enquiries, consultations] = await Promise.all([
    prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, createdAt: true } }),
    prisma.enquiry.findMany({ where: { id: { in: enquiryIds } }, select: { id: true, createdAt: true } }),
    prisma.consultation.findMany({ where: { id: { in: consultationIds } }, select: { id: true, createdAt: true } }),
  ]);
  const createdAtByKey = new Map<string, Date>([
    ...leads.map((l): [string, Date] => [`LEAD:${l.id}`, l.createdAt]),
    ...enquiries.map((e): [string, Date] => [`ENQUIRY:${e.id}`, e.createdAt]),
    ...consultations.map((c): [string, Date] => [`CONSULTATION:${c.id}`, c.createdAt]),
  ]);

  const bySubject = new Map<string, typeof transitions>();
  for (const t of transitions) {
    const key = subjectKey(t);
    if (!bySubject.has(key)) bySubject.set(key, []);
    bySubject.get(key)!.push(t);
  }

  const daysByStage = new Map<PipelineStage, number[]>();
  for (const [key, subjectTransitions] of bySubject) {
    let previousAt = createdAtByKey.get(key);
    for (const t of subjectTransitions) {
      if (previousAt) {
        const days = (t.createdAt.getTime() - previousAt.getTime()) / (1000 * 60 * 60 * 24);
        const stage = t.fromStage!;
        if (!daysByStage.has(stage)) daysByStage.set(stage, []);
        daysByStage.get(stage)!.push(days);
      }
      previousAt = t.createdAt;
    }
  }

  return ACTIVE_STAGES.map((stage) => {
    const samples = daysByStage.get(stage) ?? [];
    return {
      stage,
      avgDays: samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : null,
      sampleSize: samples.length,
    };
  });
}

async function getVendorAvailability(date: Date): Promise<FounderDashboard['vendorAvailability']> {
  const rows = await prisma.vendorAvailability.findMany({
    where: { date: startOfDay(date) },
    include: { vendor: { select: { category: { select: { name: true } } } } },
  });

  const byCategory = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const category = row.vendor.category.name;
    if (!byCategory.has(category)) byCategory.set(category, {});
    const counts = byCategory.get(category)!;
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }

  return {
    date: startOfDay(date).toISOString().slice(0, 10),
    categories: [...byCategory.entries()].map(([category, counts]) => ({ category, counts })),
  };
}

async function getFollowUpHealth(): Promise<FounderDashboard['followUpHealth']> {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const OPEN: ('PENDING' | 'IN_PROGRESS')[] = ['PENDING', 'IN_PROGRESS'];

  const [dueToday, overdue, completedToday] = await Promise.all([
    prisma.task.count({
      where: { context: 'SALES_FOLLOWUP', status: { in: OPEN }, dueAt: { gte: today, lt: tomorrow } },
    }),
    prisma.task.count({
      where: { context: 'SALES_FOLLOWUP', status: { in: OPEN }, dueAt: { lt: now } },
    }),
    prisma.task.count({
      where: { context: 'SALES_FOLLOWUP', completedAt: { gte: today, lt: tomorrow } },
    }),
  ]);
  return { dueToday, overdue, completedToday };
}

async function getTeamPerformance(): Promise<FounderDashboard['teamPerformance']> {
  const monthStart = startOfMonth(new Date());
  const reps = await prisma.user.findMany({
    where: { roles: { some: { role: { in: ['SUPER_ADMIN', 'SALES', 'OPERATIONS'] } } } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  async function statsFor(assignedToId: string | null) {
    // wonThisMonth/lostThisMonth use `updatedAt` as a "reached this stage"
    // proxy (any field edit bumps it, not just a stage change) — same kind
    // of documented approximation as leadInboxService.stats()'s 24h overdue
    // window, acceptable until/unless it proves wrong with real volume.
    const [open, wonThisMonth, lostThisMonth] = await Promise.all([
      countAcrossAll({ assignedToId, pipelineStage: { notIn: ['WON', 'LOST'] } }),
      countAcrossAll({ assignedToId, pipelineStage: 'WON', updatedAt: { gte: monthStart } }),
      countAcrossAll({ assignedToId, pipelineStage: 'LOST', updatedAt: { gte: monthStart } }),
    ]);
    return { open, wonThisMonth, lostThisMonth };
  }

  const rows = await Promise.all([
    statsFor(null).then((s) => ({ userId: null, name: 'Unassigned', ...s })),
    ...reps.map((rep) => statsFor(rep.id).then((s) => ({ userId: rep.id, name: rep.name ?? rep.id, ...s }))),
  ]);
  return rows;
}

export const founderDashboardService = {
  async getDashboard(date: Date = new Date()): Promise<FounderDashboard> {
    const [commandCenter, revenue, commission, pipelineHealth, velocity, vendorAvailability, followUpHealth, teamPerformance] =
      await Promise.all([
        commandCenterService.getDashboard(date),
        getRevenue(),
        getCommission(),
        getPipelineHealth(),
        getVelocity(),
        getVendorAvailability(date),
        getFollowUpHealth(),
        getTeamPerformance(),
      ]);
    return { commandCenter, revenue, commission, pipelineHealth, velocity, vendorAvailability, followUpHealth, teamPerformance };
  },
};
