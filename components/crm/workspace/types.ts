// Mirrors services/leadWorkspace.service.ts's LeadWorkspace, with Date
// fields as ISO strings (JSON serialization), same convention as
// components/crm/types.ts's LeadInboxItem vs. the service's Date fields.
import type { PipelineStage, SourceType } from '@/components/crm/types';
import type { LostReason } from '@/lib/crm/pipeline';

export interface WorkspaceActivity {
  id: string;
  type: string;
  summary: string;
  detail: string | null;
  aiGenerated: boolean;
  performedByName: string | null;
  createdAt: string;
}

export interface WorkspaceTask {
  id: string;
  title: string;
  description: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueAt: string | null;
  completedAt: string | null;
  assignedToName: string | null;
  createdAt: string;
}

export interface WorkspaceInsight {
  id: string;
  generatedBy: 'AI' | 'HUMAN';
  source: string | null;
  summary: string;
  nextAction: string | null;
  sentiment: string | null;
  confidence: number | null;
  createdAt: string;
}

export interface LeadWorkspace {
  subject: {
    sourceType: SourceType;
    id: string;
    pipelineStage: PipelineStage;
    assignedTo: { id: string; name: string | null } | null;
    assignedBy: { id: string; name: string | null } | null;
    assignedAt: string | null;
    lostReason: LostReason | null;
    lostReasonDetail: string | null;
    holdReason: string | null;
    createdAt: string;
  };
  customer: { name: string | null; phone: string; email: string | null; city: string | null };
  weddingDetails: {
    date: string | null;
    type: string | null;
    guestCount: number | null;
    budget: number | null;
    venueType: string | null;
    services: string[];
  };
  vendorInterest: { vendorId: string; vendorName: string; vendorCategory: string }[];
  timeline: WorkspaceActivity[];
  tasks: WorkspaceTask[];
  insights: WorkspaceInsight[];
}
