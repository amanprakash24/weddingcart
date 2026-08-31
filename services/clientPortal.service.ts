import { prisma } from '@/lib/prisma';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { approvalService } from '@/services/approval.service';

const CLIENT_ACTIVITY_TYPES = new Set([
  'STATUS_CHANGED', 'VENDOR_CONFIRMED', 'VENDOR_DECLINED', 'PAYMENT_RECEIVED',
  'TASK_COMPLETED', 'DOCUMENT_UPLOADED',
]);

export interface ClientPortalEvent {
  id: string;
  weddingNumber: string;
  clientName: string;
  eventType: string;
  primaryDate: string;
  city: string;
  guestCount: number | null;
  status: string;
  coordinatorName: string | null;
  couple: { brideName: string | null; groomName: string | null } | null;
  functions: {
    id: string;
    name: string;
    date: string;
    startTime: string | null;
    location: string;
    status: string;
    services: { name: string; status: string; provider: string | null }[];
  }[];
  services: { name: string; functionName: string; status: string; provider: string | null }[];
  tasks: { id: string; title: string; status: string; dueAt: string | null }[];
  timeline: { id: string; label: string; status: string; dueDate: string | null }[];
  finance: {
    total: number;
    paid: number;
    pending: number;
    nextPayment: { amount: number; dueDate: string | null; url: string | null } | null;
    invoices: { id: string; number: string; total: number; paid: number; pending: number; status: string; paymentUrl: string | null }[];
    payments: { id: string; amount: number; method: string; paidAt: string }[];
  };
  documents: { id: string; fileName: string; category: string; url: string; createdAt: string }[];
  activity: { id: string; type: string; summary: string; createdAt: string }[];
  approvals: { id: string; type: string; title: string; description: string | null; amount: number | null; deadline: string | null; functionName: string | null; status: string; clientComment: string | null }[];
  guests: { id: string; name: string; phone: string | null; email: string | null; category: string | null; accompanyingGuests: number; rsvpStatus: string; rsvpToken: string; functionResponses: { status: string; weddingEvent: { id: string; type: string; label: string | null } }[] }[];
}

export const clientPortalService = {
  async getEventsForClient(userId: string): Promise<ClientPortalEvent[]> {
    const ownedWeddings = await prisma.wedding.findMany({
      where: { customerId: userId },
      select: { id: true },
      orderBy: { primaryDate: 'asc' },
    });

    const workspaces = await Promise.all(ownedWeddings.map(({ id }) => weddingWorkspaceService.getWorkspace(id)));
    const approvals = await approvalService.listForClient(userId);
    return workspaces.map((workspace) => {
      const { wedding, couple, events, tasks, timeline, finance, documents, activity, guests } = workspace;
      const services = events.flatMap((event) =>
        event.vendorBookings.map((booking) => ({
          name: booking.vendorCategory || 'Service',
          functionName: event.label || event.type,
          status: booking.status,
          provider: booking.vendorName || null,
        }))
      );
      const invoices = finance.invoices.map((invoice) => {
        const activeLink = invoice.paymentLinks.find((link) => link.status === 'CREATED');
        return {
          id: invoice.id,
          number: invoice.invoiceNumber,
          total: invoice.total,
          paid: invoice.amountPaid,
          pending: Math.max(0, invoice.outstanding),
          status: invoice.status,
          paymentUrl: activeLink?.shortUrl ?? null,
        };
      });
      const nextPayment = invoices
        .filter((invoice) => invoice.pending > 0)
        .sort((a, b) => a.pending - b.pending)[0];

      return {
        id: wedding.id,
        weddingNumber: wedding.weddingNumber,
        clientName: wedding.customerName || [couple?.brideName, couple?.groomName].filter(Boolean).join(' & ') || 'Client',
        eventType: wedding.weddingType || 'Event',
        primaryDate: wedding.primaryDate.toISOString(),
        city: wedding.city,
        guestCount: wedding.guestCount,
        status: wedding.status,
        coordinatorName: wedding.coordinatorName,
        couple: couple ? { brideName: couple.brideName, groomName: couple.groomName } : null,
        functions: events.map((event) => ({
          id: event.id,
          name: event.label || event.type,
          date: event.date.toISOString(),
          startTime: event.startTime,
          location: event.venueName || event.venueAddress || event.city,
          status: event.vendorBookings.length > 0 ? 'SERVICES IN PROGRESS' : 'PLANNING',
          services: event.vendorBookings.map((booking) => ({
            name: booking.vendorCategory || 'Service',
            status: booking.status,
            provider: booking.vendorName || null,
          })),
        })),
        services,
        tasks: tasks
          .filter((task) => task.context === 'WEDDING_TASK')
          .map((task) => ({ id: task.id, title: task.title, status: task.status, dueAt: task.dueAt?.toISOString() ?? null })),
        timeline: timeline.map((milestone) => ({
          id: milestone.id,
          label: milestone.label,
          status: milestone.status,
          dueDate: milestone.dueDate?.toISOString() ?? null,
        })),
        finance: {
          total: finance.totals.invoicedTotal,
          paid: finance.totals.collected,
          pending: finance.totals.outstanding,
          nextPayment: nextPayment ? { amount: nextPayment.pending, dueDate: null, url: nextPayment.paymentUrl } : null,
          invoices,
          payments: finance.invoices.flatMap((invoice) => invoice.payments
            .filter((payment) => payment.status === 'SUCCESS')
            .map((payment) => ({ id: payment.id, amount: payment.amount, method: payment.method, paidAt: payment.paidAt.toISOString() }))),
        },
        documents: documents
          .filter((document) => document.visibility === 'CUSTOMER_VISIBLE')
          .map((document) => ({ id: document.id, fileName: document.fileName, category: document.category, url: document.url, createdAt: document.createdAt.toISOString() })),
        activity: activity
          .filter((entry) => CLIENT_ACTIVITY_TYPES.has(entry.type))
          .map((entry) => ({ id: entry.id, type: entry.type, summary: entry.type === 'PAYMENT_RECEIVED' ? entry.summary : entry.summary, createdAt: entry.createdAt.toISOString() })),
        approvals: approvals.filter((approval) => approval.weddingId === wedding.id).map((approval) => ({
          id: approval.id,
          type: approval.subjectType,
          title: approval.title || 'Approval request',
          description: approval.description,
          amount: approval.amount,
          deadline: approval.deadline?.toISOString() ?? null,
          functionName: approval.weddingEvent?.label || approval.weddingEvent?.type || null,
          status: approval.status,
          clientComment: approval.clientComment,
        })),
        guests,
      };
    });
  },
};
