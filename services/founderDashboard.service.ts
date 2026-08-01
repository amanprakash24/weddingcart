import { prisma } from '@/lib/prisma';
import type { PipelineStage } from '@/generated/prisma/enums';
import { commissionRateRepository } from '@/repositories/commissionRate.repository';

// Sprint 5.4 — Founder Dashboard. Today's Work stays on the existing
// leadInboxService.stats()/`/api/crm/stats` (Sprint 5.1, unchanged); this
// service is purely additive, one aggregate read per docs/wedding-os/
// 01-command-center.md §4.1's already-resolved sourcing, composing 6
// independent, individually empty-safe queries.

export interface FounderDashboard {
  revenue: {
    outstanding: number;
    totalCollected: number;
    invoicedThisMonth: { count: number; total: number };
    paymentsToday: number;
  };
  commission: {
    confirmed: number;
    pendingWeddings: number;
    expected: number;
    outstandingPayoutAmount: number;
    pendingPayoutCount: number;
    grossMargin: number;
  };
  revenueByMonth: { month: string; total: number }[];
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

// Sprint 7.4 — `Invoice.amountPaid` is a Phase A stored column that every
// other Wedding OS code path (weddingWorkspace.service.ts, payment.service.ts)
// already treats as superseded by computed-on-read Payment sums. This was
// the one holdout still trusting it; fixed to match.
async function getRevenue(): Promise<FounderDashboard['revenue']> {
  const now = new Date();
  const [totalAgg, outstandingPaidAgg, collectedAgg, monthAgg, paymentsTodayAgg] = await Promise.all([
    prisma.invoice.aggregate({ where: { status: { notIn: ['DRAFT', 'PAID'] } }, _sum: { total: true } }),
    prisma.payment.aggregate({
      where: { status: 'SUCCESS', invoice: { status: { notIn: ['DRAFT', 'PAID'] } } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'SUCCESS', invoice: { status: { not: 'DRAFT' } } },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: { status: { not: 'DRAFT' }, createdAt: { gte: startOfMonth(now) } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.payment.aggregate({ where: { paidAt: { gte: startOfDay(now) }, status: 'SUCCESS' }, _sum: { amount: true } }),
  ]);

  return {
    outstanding: (totalAgg._sum.total ?? 0) - (outstandingPaidAgg._sum.amount ?? 0),
    totalCollected: collectedAgg._sum.amount ?? 0,
    invoicedThisMonth: { count: monthAgg._count, total: monthAgg._sum.total ?? 0 },
    paymentsToday: paymentsTodayAgg._sum.amount ?? 0,
  };
}

// Sprint 7.4 — live-computed forecast, nothing stored: commission that would
// be realized if every currently-CONFIRMED booking completed at today's
// rates. Empty-safe short-circuit avoids resolving any CommissionRate at all
// when there's nothing to compute, same pattern as getVelocity()'s 0-sample case.
async function getExpectedCommission(): Promise<number> {
  const confirmedBookings = await prisma.vendorBooking.findMany({
    where: { status: 'CONFIRMED' },
    select: { agreedPrice: true, vendor: { select: { categoryId: true } } },
  });
  if (confirmedBookings.length === 0) return 0;

  const categoryIds = [...new Set(confirmedBookings.map((b) => b.vendor.categoryId))];
  const rates = await Promise.all(categoryIds.map((id) => commissionRateRepository.findCurrentRate(id)));
  const rateByCategoryId = new Map(categoryIds.map((id, i) => [id, rates[i].rate]));

  return confirmedBookings.reduce((sum, b) => {
    const rate = rateByCategoryId.get(b.vendor.categoryId)!;
    return sum + Math.round((b.agreedPrice * rate) / 100);
  }, 0);
}

async function getCommission(): Promise<FounderDashboard['commission']> {
  const [paidPayoutAgg, pendingPayoutAgg, allSuccessfulPaymentsAgg, pendingWeddings, expected] = await Promise.all([
    prisma.payout.aggregate({ where: { status: 'PAID' }, _sum: { commissionAmount: true, netAmount: true } }),
    prisma.payout.aggregate({ where: { status: 'PENDING' }, _sum: { netAmount: true }, _count: true }),
    // No invoice-status filter, deliberately different from revenue.totalCollected
    // above — a successful payment means money moved regardless of the
    // invoice's current display status. This is the cash side of Gross Margin.
    prisma.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true } }),
    prisma.wedding.count({ where: { status: { not: 'COMPLETED' } } }),
    getExpectedCommission(),
  ]);

  return {
    confirmed: paidPayoutAgg._sum.commissionAmount ?? 0,
    pendingWeddings,
    expected,
    outstandingPayoutAmount: pendingPayoutAgg._sum.netAmount ?? 0,
    pendingPayoutCount: pendingPayoutAgg._count,
    // Gross Margin (cash) can genuinely diverge from confirmed commission
    // (accrual) when an invoice bundles GST/discounts/non-vendor-booking
    // line items — that's a real reconciliation signal, not a bug.
    grossMargin: (allSuccessfulPaymentsAgg._sum.amount ?? 0) - (paidPayoutAgg._sum.netAmount ?? 0),
  };
}

// Last 6 months of successful-payment revenue, bucketed in JS rather than a
// SQL groupBy/date_trunc — same precedent as getVelocity() below for
// time-based aggregation. Every month is present even at 0 (no "only push if
// non-zero" shortcut), so a real empty month reads as 0, not missing.
async function getRevenueByMonth(): Promise<FounderDashboard['revenueByMonth']> {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const payments = await prisma.payment.findMany({
    where: { status: 'SUCCESS', paidAt: { gte: sixMonthsAgo } },
    select: { amount: true, paidAt: true },
  });

  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const totalsByMonth = new Map<string, number>();
  for (const p of payments) {
    const key = monthKey(p.paidAt);
    totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + p.amount);
  }

  const result: FounderDashboard['revenueByMonth'] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    result.push({ month: key, total: totalsByMonth.get(key) ?? 0 });
  }
  return result;
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
    const [revenue, commission, revenueByMonth, pipelineHealth, velocity, vendorAvailability, followUpHealth, teamPerformance] =
      await Promise.all([
        getRevenue(),
        getCommission(),
        getRevenueByMonth(),
        getPipelineHealth(),
        getVelocity(),
        getVendorAvailability(date),
        getFollowUpHealth(),
        getTeamPerformance(),
      ]);
    return { revenue, commission, revenueByMonth, pipelineHealth, velocity, vendorAvailability, followUpHealth, teamPerformance };
  },
};
