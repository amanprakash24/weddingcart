import type { SourceType } from '@/services/leadInbox.service';

// Lead/Enquiry/Consultation each get their own FK column on Task/ActivityLog/
// LeadInsight (see prisma/schema.prisma "exactly one subject is set" comment
// on those models) — this is the one place that maps a workspace's
// {sourceType, id} into the right `where` clause, reused by every query that
// needs a subject's tasks/activity/insights instead of repeating the branch.

export const VALID_SOURCE_TYPES: SourceType[] = ['LEAD', 'ENQUIRY', 'CONSULTATION'];

export function isSourceType(value: string): value is SourceType {
  return (VALID_SOURCE_TYPES as string[]).includes(value);
}

export function subjectWhere(sourceType: SourceType, id: string) {
  switch (sourceType) {
    case 'LEAD':
      return { leadId: id };
    case 'ENQUIRY':
      return { enquiryId: id };
    case 'CONSULTATION':
      return { consultationId: id };
  }
}

// Repositories are typed against Prisma's checked `*CreateInput` (see
// docs/repository-contract.md), which requires relation `connect` syntax
// rather than a raw scalar FK — unlike subjectWhere's `where` clauses, which
// accept the scalar column directly.
export function subjectCreateData(sourceType: SourceType, id: string) {
  switch (sourceType) {
    case 'LEAD':
      return { lead: { connect: { id } } };
    case 'ENQUIRY':
      return { enquiry: { connect: { id } } };
    case 'CONSULTATION':
      return { consultation: { connect: { id } } };
  }
}
