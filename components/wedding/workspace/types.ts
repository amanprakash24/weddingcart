// Mirrors services/weddingWorkspace.service.ts's WeddingWorkspace, Date
// fields as ISO strings — same JSON-serialization convention as
// components/crm/workspace/types.ts.
import type { WorkspaceActivity, WorkspaceTask, WorkspaceInsight } from '@/components/crm/workspace/types';

export type WeddingStatus = 'PLANNING' | 'ACTIVE' | 'POSTPONED' | 'COMPLETED' | 'CANCELLED';
export type VendorBookingStatus =
  | 'PENDING_VENDOR_CONFIRMATION'
  | 'CONFIRMED'
  | 'DECLINED'
  | 'CUSTOMER_APPROVAL_PENDING'
  | 'CANCELLED'
  | 'COMPLETED';
export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
export type WeddingHealth = 'HEALTHY' | 'AT_RISK' | 'OVERDUE';

export interface WorkspaceVendorBooking {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorCategory: string;
  status: VendorBookingStatus;
  agreedPrice: number;
  declineReason: string | null;
  respondedAt: string | null;
  onTimeService: boolean | null;
}

export interface VendorSearchResult {
  id: string;
  name: string;
  city: string;
  category: string;
}

export interface WorkspaceWeddingEvent {
  id: string;
  type: string;
  label: string | null;
  date: string;
  startTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  city: string;
  budget: number | null;
  vendorBookings: WorkspaceVendorBooking[];
}

export interface WorkspaceMilestone {
  id: string;
  label: string;
  sortOrder: number;
  status: MilestoneStatus;
  dueDate: string | null;
}

export interface WorkspaceDocument {
  id: string;
  category: string;
  visibility: 'INTERNAL' | 'CUSTOMER_VISIBLE';
  fileName: string;
  url: string;
  createdAt: string;
}

export interface WeddingWorkspace {
  wedding: {
    id: string;
    weddingNumber: string;
    status: WeddingStatus;
    source: 'CRM' | 'BOOKING';
    primaryDate: string;
    city: string;
    guestCount: number | null;
    weddingType: string | null;
    totalBudget: number | null;
    coordinatorName: string | null;
    customerName: string | null;
    createdAt: string;
    completedAt: string | null;
  };
  health: WeddingHealth;
  couple: {
    brideName: string | null;
    bridePhone: string | null;
    groomName: string | null;
    groomPhone: string | null;
    preferredLanguage: string | null;
    preferences: string | null;
  } | null;
  events: WorkspaceWeddingEvent[];
  timeline: WorkspaceMilestone[];
  activity: WorkspaceActivity[];
  tasks: WorkspaceTask[];
  documents: WorkspaceDocument[];
  insights: WorkspaceInsight[];
}
