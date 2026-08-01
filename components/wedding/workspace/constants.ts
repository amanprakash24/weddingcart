import type { WeddingStatus, WeddingHealth, InvoiceStatus, PaymentLinkStatus, PayoutStatus } from './types';

export const STATUS_LABELS: Record<WeddingStatus, string> = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  POSTPONED: 'Postponed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const STATUS_COLORS: Record<WeddingStatus, string> = {
  PLANNING: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  POSTPONED: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-gray-200 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
};

// Mirrors lib/wedding/lifecycle.ts's WEDDING_STATUS_TRANSITIONS — PLANNING is
// intentionally absent as a target anywhere except from POSTPONED, since
// PLANNING->ACTIVE only ever happens automatically (domain-model.md §5.2).
export const WEDDING_STATUS_TRANSITIONS: Record<WeddingStatus, WeddingStatus[]> = {
  PLANNING: ['POSTPONED', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'POSTPONED', 'CANCELLED'],
  POSTPONED: ['PLANNING', 'ACTIVE'],
  COMPLETED: [],
  CANCELLED: [],
};

export const HEALTH_LABELS: Record<WeddingHealth, string> = {
  HEALTHY: 'Healthy',
  AT_RISK: 'At Risk',
  OVERDUE: 'Overdue',
};

export const HEALTH_COLORS: Record<WeddingHealth, string> = {
  HEALTHY: 'bg-emerald-100 text-emerald-700',
  AT_RISK: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-red-100 text-red-700',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PAID: 'Paid',
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-gray-200 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-emerald-100 text-emerald-700',
};

export const PAYMENT_LINK_STATUS_LABELS: Record<PaymentLinkStatus, string> = {
  CREATED: 'Sent',
  PAID: 'Paid',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

export const PAYMENT_LINK_STATUS_COLORS: Record<PaymentLinkStatus, string> = {
  CREATED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  EXPIRED: 'bg-gray-200 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
};

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  PENDING: 'Payout Pending',
  PROCESSING: 'Processing',
  PAID: 'Paid Out',
  FAILED: 'Failed',
};

export const PAYOUT_STATUS_COLORS: Record<PayoutStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
};
