import { leadRepository } from '@/repositories/lead.repository';
import { enquiryRepository } from '@/repositories/enquiry.repository';
import { consultationRepository } from '@/repositories/consultation.repository';
import { prisma } from '@/lib/prisma';
import { Prisma, type PipelineStage } from '@/generated/prisma/client';

// Unified "Lead Inbox" per docs/wedding-os/02-crm.md §2: Lead/Enquiry/Consultation
// stay three separate tables (genuinely different capture shapes — Lead has no
// name/city/budget, it's phone-only popup capture) but feed one pipeline view.
// Composed here rather than with a SQL-level UNION: current combined row count
// is small (tens, not thousands — see docs/migration-log.md), so an in-app
// merge+sort+paginate is simple and correct. Revisit with a real query-level
// union only if volume grows enough to matter.

export type SourceType = 'LEAD' | 'ENQUIRY' | 'CONSULTATION';

export interface LeadInboxItem {
  id: string;
  sourceType: SourceType;
  name: string | null;
  phone: string;
  city: string | null;
  pipelineStage: PipelineStage;
  assignedToId: string | null;
  assignedToName: string | null;
  createdAt: Date;
}

export interface LeadInboxParams {
  search?: string; // matches name (where available) or phone
  pipelineStage?: PipelineStage;
  city?: string;
  assignedToId?: string;
  sourceType?: SourceType; // filter to one capture entity type ("Lead Source")
  dateFrom?: Date;
  dateTo?: Date;
  skip?: number;
  take?: number;
}

function dateRangeFilter(params: LeadInboxParams): Prisma.DateTimeFilter | undefined {
  if (!params.dateFrom && !params.dateTo) return undefined;
  const filter: Prisma.DateTimeFilter = {};
  if (params.dateFrom) filter.gte = params.dateFrom;
  if (params.dateTo) filter.lte = params.dateTo;
  return filter;
}

async function fetchLeads(params: LeadInboxParams): Promise<{ items: LeadInboxItem[]; total: number }> {
  // Lead has no city/name column — a city filter or name-only search can never
  // match a Lead row, so skip querying it entirely rather than building an
  // impossible where clause.
  if (params.city) return { items: [], total: 0 };
  if (params.sourceType && params.sourceType !== 'LEAD') return { items: [], total: 0 };

  const where: Prisma.LeadWhereInput = {};
  if (params.pipelineStage) where.pipelineStage = params.pipelineStage;
  if (params.assignedToId) where.assignedToId = params.assignedToId;
  const createdAt = dateRangeFilter(params);
  if (createdAt) where.createdAt = createdAt;
  if (params.search) where.phone = { contains: params.search, mode: 'insensitive' };

  const fetchLimit = (params.skip ?? 0) + (params.take ?? 20);
  const { data, total } = await leadRepository.findMany({ where, take: fetchLimit, orderBy: { createdAt: 'desc' } });
  const items = await withAssignedNames(
    data.map((lead) => ({
      id: lead.id,
      sourceType: 'LEAD' as const,
      name: null,
      phone: lead.phone,
      city: null,
      pipelineStage: lead.pipelineStage,
      assignedToId: lead.assignedToId,
      assignedToName: null,
      createdAt: lead.createdAt,
    }))
  );
  return { items, total };
}

async function fetchEnquiries(params: LeadInboxParams): Promise<{ items: LeadInboxItem[]; total: number }> {
  if (params.sourceType && params.sourceType !== 'ENQUIRY') return { items: [], total: 0 };

  const where: Prisma.EnquiryWhereInput = {};
  if (params.pipelineStage) where.pipelineStage = params.pipelineStage;
  if (params.assignedToId) where.assignedToId = params.assignedToId;
  if (params.city) where.city = { equals: params.city, mode: 'insensitive' };
  const createdAt = dateRangeFilter(params);
  if (createdAt) where.createdAt = createdAt;
  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { phone: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const fetchLimit = (params.skip ?? 0) + (params.take ?? 20);
  const { data, total } = await enquiryRepository.findMany({
    where,
    take: fetchLimit,
    orderBy: { createdAt: 'desc' },
    // assignedTo relation not needed on the where clause but is on the select below
  });
  const items = await withAssignedNames(
    data.map((e) => ({
      id: e.id,
      sourceType: 'ENQUIRY' as const,
      name: e.name,
      phone: e.phone,
      city: e.city,
      pipelineStage: e.pipelineStage,
      assignedToId: e.assignedToId,
      assignedToName: null as string | null,
      createdAt: e.createdAt,
    }))
  );
  return { items, total };
}

async function fetchConsultations(params: LeadInboxParams): Promise<{ items: LeadInboxItem[]; total: number }> {
  if (params.sourceType && params.sourceType !== 'CONSULTATION') return { items: [], total: 0 };

  const where: Prisma.ConsultationWhereInput = {};
  if (params.pipelineStage) where.pipelineStage = params.pipelineStage;
  if (params.assignedToId) where.assignedToId = params.assignedToId;
  if (params.city) where.city = { equals: params.city, mode: 'insensitive' };
  const createdAt = dateRangeFilter(params);
  if (createdAt) where.createdAt = createdAt;
  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { phone: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const fetchLimit = (params.skip ?? 0) + (params.take ?? 20);
  const { data, total } = await consultationRepository.findMany({ where, take: fetchLimit, orderBy: { createdAt: 'desc' } });
  const items = await withAssignedNames(
    data.map((c) => ({
      id: c.id,
      sourceType: 'CONSULTATION' as const,
      name: c.name,
      phone: c.phone,
      city: c.city,
      pipelineStage: c.pipelineStage,
      assignedToId: c.assignedToId,
      assignedToName: null,
      createdAt: c.createdAt,
    }))
  );
  return { items, total };
}

// Lead/Enquiry/Consultation repositories return raw rows without the assignedTo
// relation loaded — resolved here in one batched query rather than N+1s,
// shared by both fetch functions.
async function withAssignedNames(items: LeadInboxItem[]): Promise<LeadInboxItem[]> {
  const ids = [...new Set(items.map((i) => i.assignedToId).filter((id): id is string => !!id))];
  if (ids.length === 0) return items;
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  return items.map((i) => ({ ...i, assignedToName: i.assignedToId ? (nameById.get(i.assignedToId) ?? null) : null }));
}

export const leadInboxService = {
  async list(params: LeadInboxParams): Promise<{ data: LeadInboxItem[]; total: number }> {
    const [leads, enquiries, consultations] = await Promise.all([
      fetchLeads(params),
      fetchEnquiries(params),
      fetchConsultations(params),
    ]);

    const merged = [...leads.items, ...enquiries.items, ...consultations.items].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    // Each source fetches only its newest skip+take rows (enough to fill this page after the merge),
    // so the true total comes from the per-source counts, not the merged length.
    const total = leads.total + enquiries.total + consultations.total;
    const skip = params.skip ?? 0;
    const take = params.take ?? 20;
    return { data: merged.slice(skip, skip + take), total };
  },

  // Today's Work / Stats Cards data — counts only, no row data. Split from
  // list() so the dashboard's stat cards and the lead table can load/refresh
  // independently (components/crm/StatsCards.tsx vs LeadTable.tsx).
  async stats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Placeholder SLA window (24h) for "overdue" — 02-crm.md §7 flags the real
    // SLA config location (settings table vs. hardcoded) as still undecided;
    // this is a reasonable default until that's resolved, not the final answer.
    const overdueSince = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      newToday,
      siteVisitsScheduled,
      totalOpen,
      overdueCount,
      byStage,
    ] = await Promise.all([
      countAcrossAll({ createdAt: { gte: startOfToday } }),
      countAcrossAll({ pipelineStage: 'SITE_VISIT_SCHEDULED' }),
      countAcrossAll({ pipelineStage: { notIn: ['WON', 'LOST'] } }),
      countAcrossAll({ pipelineStage: 'NEW', createdBefore: overdueSince }),
      countByStage(),
    ]);

    return { newToday, siteVisitsScheduled, totalOpen, overdueCount, byStage };
  },
};

async function countAcrossAll(filter: {
  createdAt?: { gte: Date };
  createdBefore?: Date;
  pipelineStage?: PipelineStage | { notIn: PipelineStage[] };
}): Promise<number> {
  // createdAt (gte) and createdBefore (lt) are never both passed by any caller
  // in this file — kept as separate params rather than one merged filter for
  // caller-side clarity, translated to a single Prisma `createdAt` clause here.
  const where: Prisma.LeadWhereInput & Prisma.EnquiryWhereInput & Prisma.ConsultationWhereInput = {
    pipelineStage: filter.pipelineStage,
    createdAt: filter.createdBefore ? { lt: filter.createdBefore } : filter.createdAt,
  };

  const [leads, enquiries, consultations] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.enquiry.count({ where }),
    prisma.consultation.count({ where }),
  ]);
  return leads + enquiries + consultations;
}

async function countByStage(): Promise<Record<PipelineStage, number>> {
  const stages: PipelineStage[] = [
    'NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT_SCHEDULED', 'QUOTATION_SENT', 'NEGOTIATION', 'ACCEPTED', 'WON', 'LOST', 'ON_HOLD',
  ];
  const counts = await Promise.all(stages.map((stage) => countAcrossAll({ pipelineStage: stage })));
  return Object.fromEntries(stages.map((stage, i) => [stage, counts[i]])) as Record<PipelineStage, number>;
}
