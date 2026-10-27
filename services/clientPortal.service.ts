import { prisma } from '@/lib/prisma';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { approvalService } from '@/services/approval.service';
import { customerActivityText } from '@/lib/customer/activityText';
import { coupleWeddings, weddingScope } from '@/lib/customer/coupleEntry';
import { runInScope } from '@/lib/ownership/scope';
import { PLATFORM_BUSINESS_ID } from '@/lib/ownership/owned';
import { upiLink, upiPayeeFrom, upiPayeeOf } from '@/lib/payments/upi';


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
  // My Wedding (28 Oct 2026): who runs this wedding (Shaadi Shopping, or a venue / vendor on Vivah OS) and how to reach them.
  business: { name: string; isShaadiShopping: boolean; phone: string | null };
  budget: number | null;
  // The agreed total (the accepted quotation; else what was invoiced), what was received, what is still due, the next amount to
  // pay, and where to pay it by UPI (the business's own UPI; Shaadi Shopping's from the server env). payTo null = not set up.
  money: { agreed: number; received: number; due: number; next: number | null; payTo: { upiId: string; payee: string; link: string } | null };
}

export const clientPortalService = {
  async getEventsForClient(userId: string): Promise<ClientPortalEvent[]> {
    // The couple's weddings, each read AS ITS OWN BUSINESS — Shaadi Shopping's, or a venue's on Vivah OS (lib/customer/coupleEntry.ts).
    const owned = await coupleWeddings(userId);
    return Promise.all(owned.map((w) => runInScope(weddingScope(w.businessId), () => this.buildEvent(w.id, w.businessId, userId))));
  },

  async buildEvent(weddingId: string, businessId: string, userId: string): Promise<ClientPortalEvent> {
    const [workspace, approvals, biz] = await Promise.all([
      weddingWorkspaceService.getWorkspace(weddingId),
      approvalService.listForClient(userId),
      prisma.business.findUnique({ where: { id: businessId }, select: { name: true, contactPhone: true, upiId: true, upiName: true } }),
    ]);
    return [workspace].map((workspace) => {
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
        // Fixed customer-safe sentences only — staff summaries can carry prices and commission (lib/customer/activityText.ts).
        activity: activity
          .map((entry) => ({ entry, text: customerActivityText(entry.type) }))
          .filter((x): x is { entry: (typeof activity)[number]; text: string } => x.text !== null)
          .map(({ entry, text }) => ({ id: entry.id, type: entry.type, summary: text, createdAt: entry.createdAt.toISOString() })),
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
        business: {
          name: biz?.name ?? 'Shaadi Shopping',
          isShaadiShopping: businessId === PLATFORM_BUSINESS_ID,
          phone: businessId === PLATFORM_BUSINESS_ID ? null : biz?.contactPhone ?? null,
        },
        budget: wedding.totalBudget ?? null,
        money: (() => {
          const deal = finance.agreement;
          const agreed = deal?.money?.agreementTotal ?? deal?.total ?? finance.totals.invoicedTotal;
          const received = deal?.money ? deal.money.received : finance.totals.collected;
          const due = Math.max(0, agreed - received);
          const next = nextPayment?.pending ?? (due > 0 ? due : null);
          const payee = businessId === PLATFORM_BUSINESS_ID ? upiPayeeFrom({ SHAADI_UPI_ID: process.env.SHAADI_UPI_ID, SHAADI_UPI_NAME: process.env.SHAADI_UPI_NAME }) : biz ? upiPayeeOf(biz) : null;
          return { agreed, received, due, next, payTo: payee && next ? { upiId: payee.vpa, payee: payee.payee, link: upiLink(payee, next, `${wedding.weddingNumber} payment`) } : null };
        })(),
      };
    })[0];
  },
};
