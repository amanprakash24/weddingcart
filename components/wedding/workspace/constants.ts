import type { InvoiceStatus, InvoiceKind, ManualPaymentMethod, PaymentLinkStatus, PayoutStatus } from './types';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PARTIALLY_PAID: 'Partly paid',
  PAID: 'Paid',
};

export const INVOICE_KIND_LABELS: Record<InvoiceKind, string> = {
  ADVANCE: 'Advance',
  BALANCE: 'Balance',
  OTHER: 'Invoice',
};

export const MANUAL_PAYMENT_LABELS: Record<ManualPaymentMethod, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-gray-200 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
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
