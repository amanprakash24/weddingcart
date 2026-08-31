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
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID';
export type PaymentStatus = 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type PaymentLinkStatus = 'CREATED' | 'PAID' | 'EXPIRED' | 'CANCELLED';
export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';

export interface WorkspacePayout {
  id: string;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netAmount: number;
  status: PayoutStatus;
  paidAt: string | null;
}

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
  payout: WorkspacePayout | null;
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
  tasks: { id: string; title: string; status: string; dueAt: string | null }[];
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

export interface WorkspaceInvoiceItem {
  id: string;
  description: string;
  vendorName: string | null;
  amount: number;
  quantity: number;
}

export interface WorkspacePayment {
  id: string;
  amount: number;
  method: string;
  status: PaymentStatus;
  paidAt: string;
  razorpayPaymentId: string | null;
}

export interface WorkspacePaymentLink {
  id: string;
  shortUrl: string;
  status: PaymentLinkStatus;
  expiresAt: string | null;
  createdAt: string;
}

export interface WorkspaceInvoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  status: InvoiceStatus;
  subtotal: number;
  discount: number;
  gstEnabled: boolean;
  gstAmount: number;
  total: number;
  amountPaid: number;
  outstanding: number;
  createdAt: string;
  items: WorkspaceInvoiceItem[];
  payments: WorkspacePayment[];
  paymentLinks: WorkspacePaymentLink[];
}

export interface WorkspaceFinance {
  budget: { planned: number | null; committed: number; variance: number | null };
  invoices: WorkspaceInvoice[];
  totals: { invoicedTotal: number; collected: number; outstanding: number };
}

export interface CreateInvoiceInput {
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  clientCity?: string;
  eventDate?: string;
  eventType?: string;
  gstEnabled: boolean;
  gstAmount: number;
  discount: number;
  notes?: string;
  items: { description: string; vendorName?: string; amount: number; quantity: number }[];
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
  finance: WorkspaceFinance;
  guests: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    category: string | null;
    accompanyingGuests: number;
    rsvpStatus: string;
    rsvpToken: string;
    functionResponses: { status: string; weddingEvent: { id: string; type: string; label: string | null } }[];
  }[];
  insights: WorkspaceInsight[];
}
