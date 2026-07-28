// Shared types for CRM components — mirrors services/leadInbox.service.ts's
// response shapes so components don't each redeclare them.

export type PipelineStage =
  | 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'SITE_VISIT_SCHEDULED'
  | 'QUOTATION_SENT' | 'NEGOTIATION' | 'WON' | 'LOST' | 'ON_HOLD';

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
  createdAt: string;
}

export interface LeadInboxStats {
  newToday: number;
  siteVisitsScheduled: number;
  totalOpen: number;
  overdueCount: number;
  byStage: Record<PipelineStage, number>;
}

export interface SalesRep {
  id: string;
  name: string | null;
}

export interface LeadFiltersState {
  search: string;
  stage: PipelineStage | '';
  city: string;
  assignedToId: string;
  sourceType: SourceType | '';
}

export const PIPELINE_STAGES: PipelineStage[] = [
  'NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT_SCHEDULED', 'QUOTATION_SENT', 'NEGOTIATION', 'WON', 'LOST', 'ON_HOLD',
];

// Display labels only — the underlying PipelineStage enum values are stable
// (Sprint 5.3 decision: keep the reviewed enum, relabel in the UI instead of
// renaming the schema). WON displays as "Booked".
export const STAGE_LABELS: Record<PipelineStage, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  SITE_VISIT_SCHEDULED: 'Site Visit Scheduled',
  QUOTATION_SENT: 'Quotation Sent',
  NEGOTIATION: 'Negotiation',
  WON: 'Booked',
  LOST: 'Lost',
  ON_HOLD: 'On Hold',
};

export const STAGE_COLORS: Record<PipelineStage, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  CONTACTED: 'bg-amber-100 text-amber-700',
  QUALIFIED: 'bg-violet-100 text-violet-700',
  SITE_VISIT_SCHEDULED: 'bg-cyan-100 text-cyan-700',
  QUOTATION_SENT: 'bg-orange-100 text-orange-700',
  NEGOTIATION: 'bg-pink-100 text-pink-700',
  WON: 'bg-emerald-100 text-emerald-700',
  LOST: 'bg-gray-200 text-gray-600',
  ON_HOLD: 'bg-slate-200 text-slate-600',
};

export const SOURCE_LABELS: Record<SourceType, string> = {
  LEAD: 'Lead',
  ENQUIRY: 'Enquiry',
  CONSULTATION: 'Consultation',
};
