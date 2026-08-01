import { prisma } from '@/lib/prisma';
import { resolveUserNames } from '@/lib/users';
import { weddingRepository } from '@/repositories/wedding.repository';
import { coupleRepository } from '@/repositories/couple.repository';
import { weddingEventRepository } from '@/repositories/weddingEvent.repository';
import { vendorBookingRepository } from '@/repositories/vendorBooking.repository';
import { vendorRepository } from '@/repositories/vendor.repository';
import { taskRepository } from '@/repositories/task.repository';
import { activityLogRepository } from '@/repositories/activityLog.repository';
import { timelineMilestoneRepository } from '@/repositories/timelineMilestone.repository';
import { documentRepository } from '@/repositories/document.repository';
import { invoiceRepository } from '@/repositories/invoice.repository';
import { computeWeddingHealth, type WeddingHealth } from '@/lib/wedding/health';
import { canTransitionWedding, maybeActivateWedding } from '@/lib/wedding/lifecycle';
import { NotFoundError, InvalidTransitionError } from '@/lib/errors';
import { ActivityType, type TaskStatus, type WeddingStatus, type VendorBookingStatus, type InvoiceStatus, type PaymentStatus, type PaymentLinkStatus } from '@/generated/prisma/enums';
import type { Wedding, Task, ActivityLog, Document, TimelineMilestone, Prisma } from '@/generated/prisma/client';

// Milestone 6 Phase 6.2 — one aggregate read model, same Workspace Loader
// philosophy as services/leadWorkspace.service.ts's LeadWorkspace: every
// components/wedding/workspace/* component only ever sees this shape.

export interface WeddingWorkspaceEvent {
  id: string;
  type: string;
  label: string | null;
  date: Date;
  startTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  city: string;
  budget: number | null;
  vendorBookings: {
    id: string;
    vendorId: string;
    vendorName: string;
    vendorCategory: string;
    status: VendorBookingStatus;
    agreedPrice: number;
    declineReason: string | null;
    respondedAt: Date | null;
    onTimeService: boolean | null;
  }[];
}

// Sprint 7.1 — Payment/Invoice/Payout/CommissionRate were already modeled in
// the Phase B schema pass but never wired to any repository/route until now.
// `budget.committed` reuses the vendorBookings already fetched below (no
// duplicate query); `invoices[].amountPaid` is computed from `payments`
// rather than trusted from the stored Invoice.amountPaid column, per
// docs/wedding-os/06-finance.md §2's "computed-on-read" design. Payouts/
// commission are deliberately absent — Sprint 7.3's job, once a real
// CommissionRate exists to compute them from.
export interface WeddingWorkspaceFinance {
  budget: { planned: number | null; committed: number; variance: number | null };
  invoices: {
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
    createdAt: Date;
    items: { id: string; description: string; vendorName: string | null; amount: number; quantity: number }[];
    payments: {
      id: string;
      amount: number;
      method: string;
      status: PaymentStatus;
      paidAt: Date;
      razorpayPaymentId: string | null;
    }[];
    paymentLinks: {
      id: string;
      shortUrl: string;
      status: PaymentLinkStatus;
      expiresAt: Date | null;
      createdAt: Date;
    }[];
  }[];
  totals: { invoicedTotal: number; collected: number; outstanding: number };
}

export interface WeddingWorkspace {
  wedding: Wedding & { coordinatorName: string | null; customerName: string | null };
  health: WeddingHealth;
  couple: {
    brideName: string | null;
    bridePhone: string | null;
    groomName: string | null;
    groomPhone: string | null;
    preferredLanguage: string | null;
    preferences: string | null;
  } | null;
  events: WeddingWorkspaceEvent[];
  timeline: TimelineMilestone[];
  activity: (ActivityLog & { performedByName: string | null })[];
  tasks: (Task & { assignedToName: string | null })[];
  documents: Document[];
  finance: WeddingWorkspaceFinance;
  // No backing entity yet — LeadInsight is hard-typed to lead/enquiry/
  // consultation, has no weddingId (checked against the real schema before
  // planning Milestone 6). Empty-safe placeholder, not faked data.
  insights: [];
}

async function findWeddingOrThrow(id: string): Promise<Wedding> {
  const wedding = await weddingRepository.findById(id);
  if (!wedding) throw new NotFoundError('Wedding', id);
  return wedding;
}

// INV-YYYYMM-NNNN, sequential within the month — same format already live in
// the legacy Mongo-era route (app/api/invoices/route.ts), for consistency
// rather than inventing a new numbering scheme. That route stays Mongo-backed
// (Invoices is last in the module cutover order); these wedding-linked
// invoices are Postgres-only and coexist with it, same pattern Wedding/CRM
// already established. Counts against `tx.invoice` (not a new-rows-only
// counter) since migrated legacy invoices land in this same table too.
async function generateInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date();
  const bucket = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
  const count = await tx.invoice.count({ where: { invoiceNumber: { startsWith: bucket } } });
  return `${bucket}${String(count + 1).padStart(4, '0')}`;
}

export const weddingWorkspaceService = {
  async getWorkspace(id: string): Promise<WeddingWorkspace> {
    const wedding = await findWeddingOrThrow(id);

    const [couple, { data: events }, { data: tasks }, { data: activity }, timeline, { data: documents }, { data: invoices }] =
      await Promise.all([
        coupleRepository.findByWeddingId(id),
        weddingEventRepository.findMany({ where: { weddingId: id }, orderBy: { date: 'asc' } }),
        taskRepository.findMany({ where: { weddingId: id }, orderBy: { createdAt: 'desc' } }),
        activityLogRepository.findMany({ where: { weddingId: id } }),
        timelineMilestoneRepository.findMany({ where: { weddingId: id }, orderBy: { sortOrder: 'asc' } }),
        documentRepository.findMany({ where: { weddingId: id }, orderBy: { createdAt: 'desc' } }),
        invoiceRepository.findMany({ where: { weddingId: id }, orderBy: { createdAt: 'desc' } }),
      ]);

    const eventIds = events.map((e) => e.id);
    const { data: vendorBookings } = await vendorBookingRepository.findMany({
      where: { weddingEventId: { in: eventIds } },
    });

    const vendorIds = [...new Set(vendorBookings.map((vb) => vb.vendorId))];
    // Deliberately not vendorRepository.findMany — that forces a
    // packages/faqs include this view doesn't need, and doesn't expose
    // category (a relation, not a string field on Vendor). A minimal direct
    // query is the lighter, correct fit here.
    const vendors = vendorIds.length
      ? await prisma.vendor.findMany({
          where: { id: { in: vendorIds } },
          select: { id: true, name: true, category: { select: { name: true } } },
        })
      : [];
    const vendorById = new Map(vendors.map((v) => [v.id, v]));

    const nameById = await resolveUserNames([
      wedding.coordinatorId,
      wedding.customerId,
      ...tasks.map((t) => t.assignedToId),
      ...activity.map((a) => a.performedById),
    ]);

    const eventsWithBookings: WeddingWorkspaceEvent[] = events.map((event) => ({
      id: event.id,
      type: event.type,
      label: event.label,
      date: event.date,
      startTime: event.startTime,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      city: event.city,
      budget: event.budget,
      vendorBookings: vendorBookings
        .filter((vb) => vb.weddingEventId === event.id)
        .map((vb) => {
          const vendor = vendorById.get(vb.vendorId);
          return {
            id: vb.id,
            vendorId: vb.vendorId,
            vendorName: vendor?.name ?? 'Unknown vendor',
            vendorCategory: vendor?.category.name ?? '',
            status: vb.status,
            agreedPrice: vb.agreedPrice,
            declineReason: vb.declineReason,
            respondedAt: vb.respondedAt,
            onTimeService: vb.onTimeService,
          };
        }),
    }));

    const health = computeWeddingHealth({
      status: wedding.status,
      tasks: tasks.map((t) => ({ status: t.status, dueAt: t.dueAt })),
      vendorBookings: vendorBookings.map((vb) => ({
        status: vb.status,
        eventDate: events.find((e) => e.id === vb.weddingEventId)?.date ?? wedding.primaryDate,
      })),
    });

    // committed = agreed vendor spend still on the books. Excludes CANCELLED/
    // DECLINED bookings — a judgment call, since 03-wedding-workspace.md §6
    // doesn't specify a status filter for "sum of VendorBooking.price".
    const committed = vendorBookings
      .filter((vb) => vb.status !== 'CANCELLED' && vb.status !== 'DECLINED')
      .reduce((sum, vb) => sum + vb.agreedPrice, 0);

    const financeInvoices = invoices.map((inv) => {
      const amountPaid = inv.payments
        .filter((p) => p.status === 'SUCCESS')
        .reduce((sum, p) => sum + p.amount, 0);
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.clientName,
        status: inv.status,
        subtotal: inv.subtotal,
        discount: inv.discount,
        gstEnabled: inv.gstEnabled,
        gstAmount: inv.gstAmount,
        total: inv.total,
        amountPaid,
        outstanding: inv.total - amountPaid,
        createdAt: inv.createdAt,
        items: inv.items.map((i) => ({
          id: i.id,
          description: i.description,
          vendorName: i.vendorName,
          amount: i.amount,
          quantity: i.quantity,
        })),
        payments: inv.payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          method: p.method,
          status: p.status,
          paidAt: p.paidAt,
          razorpayPaymentId: p.razorpayPaymentId,
        })),
        paymentLinks: inv.paymentLinks.map((l) => ({
          id: l.id,
          shortUrl: l.shortUrl,
          status: l.status,
          expiresAt: l.expiresAt,
          createdAt: l.createdAt,
        })),
      };
    });

    const finance: WeddingWorkspaceFinance = {
      budget: {
        planned: wedding.totalBudget,
        committed,
        variance: wedding.totalBudget !== null ? wedding.totalBudget - committed : null,
      },
      invoices: financeInvoices,
      totals: {
        invoicedTotal: financeInvoices.reduce((sum, i) => sum + i.total, 0),
        collected: financeInvoices.reduce((sum, i) => sum + i.amountPaid, 0),
        outstanding: financeInvoices.reduce((sum, i) => sum + i.outstanding, 0),
      },
    };

    return {
      wedding: {
        ...wedding,
        coordinatorName: wedding.coordinatorId ? (nameById.get(wedding.coordinatorId) ?? null) : null,
        customerName: wedding.customerId ? (nameById.get(wedding.customerId) ?? null) : null,
      },
      health,
      couple: couple
        ? {
            brideName: couple.brideName,
            bridePhone: couple.bridePhone,
            groomName: couple.groomName,
            groomPhone: couple.groomPhone,
            preferredLanguage: couple.preferredLanguage,
            preferences: couple.preferences,
          }
        : null,
      events: eventsWithBookings,
      timeline,
      activity: activity.map((a) => ({
        ...a,
        performedByName: a.performedById ? (nameById.get(a.performedById) ?? null) : null,
      })),
      tasks: tasks.map((t) => ({
        ...t,
        assignedToName: t.assignedToId ? (nameById.get(t.assignedToId) ?? null) : null,
      })),
      documents,
      finance,
      insights: [],
    };
  },

  async upsertCouple(
    weddingId: string,
    input: {
      brideName?: string;
      bridePhone?: string;
      groomName?: string;
      groomPhone?: string;
      preferredLanguage?: string;
      preferences?: string;
    }
  ) {
    await findWeddingOrThrow(weddingId);
    const existing = await coupleRepository.findByWeddingId(weddingId);
    if (existing) {
      return coupleRepository.update(weddingId, input);
    }
    return coupleRepository.create({ wedding: { connect: { id: weddingId } }, ...input });
  },

  async addNote(weddingId: string, { detail, performedById }: { detail: string; performedById: string | null }) {
    await findWeddingOrThrow(weddingId);
    return activityLogRepository.create({
      type: ActivityType.NOTE,
      summary: detail.length > 80 ? `${detail.slice(0, 77)}...` : detail,
      detail,
      performedBy: performedById ? { connect: { id: performedById } } : undefined,
      wedding: { connect: { id: weddingId } },
    });
  },

  async addTask(
    weddingId: string,
    input: {
      title: string;
      description?: string;
      dueAt?: Date;
      priority?: Task['priority'];
      assignedToId?: string;
      weddingEventId?: string;
      createdById: string | null;
    }
  ) {
    await findWeddingOrThrow(weddingId);
    return taskRepository.create({
      context: 'WEDDING_TASK',
      title: input.title,
      description: input.description,
      dueAt: input.dueAt,
      priority: input.priority,
      assignedTo: input.assignedToId ? { connect: { id: input.assignedToId } } : undefined,
      createdBy: input.createdById ? { connect: { id: input.createdById } } : undefined,
      wedding: { connect: { id: weddingId } },
      weddingEvent: input.weddingEventId ? { connect: { id: input.weddingEventId } } : undefined,
    });
  },

  async completeTask(weddingId: string, taskId: string, status: TaskStatus) {
    const task = await taskRepository.findById(taskId);
    if (!task || task.weddingId !== weddingId) throw new NotFoundError('Task', taskId);
    return taskRepository.update(taskId, { status, completedAt: status === 'DONE' ? new Date() : null });
  },

  async updateMilestone(weddingId: string, milestoneId: string, status: TimelineMilestone['status']) {
    const milestone = await timelineMilestoneRepository.findById(milestoneId);
    if (!milestone || milestone.weddingId !== weddingId) throw new NotFoundError('TimelineMilestone', milestoneId);
    return timelineMilestoneRepository.update(milestoneId, { status });
  },

  // domain-model.md §5.2 — the only route that can move a VendorBooking to
  // CONFIRMED, which is also the automatic PLANNING->ACTIVE trigger. No
  // vendor-facing self-service confirm flow exists yet (Vendor OS, a later
  // milestone), so this is Operations recording a real confirmation (phone
  // call, WhatsApp, etc.), not a placeholder.
  async updateVendorBookingStatus(weddingId: string, vendorBookingId: string, status: VendorBookingStatus, declineReason?: string) {
    const vendorBooking = await vendorBookingRepository.findById(vendorBookingId);
    if (!vendorBooking) throw new NotFoundError('VendorBooking', vendorBookingId);
    const event = await weddingEventRepository.findById(vendorBooking.weddingEventId);
    if (!event || event.weddingId !== weddingId) throw new NotFoundError('VendorBooking', vendorBookingId);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await vendorBookingRepository.update(
        vendorBookingId,
        {
          status,
          declineReason: status === 'DECLINED' ? (declineReason ?? null) : null,
          respondedAt: new Date(),
        },
        tx
      );

      await activityLogRepository.create(
        {
          type: status === 'CONFIRMED' ? ActivityType.VENDOR_CONFIRMED : status === 'DECLINED' ? ActivityType.VENDOR_DECLINED : ActivityType.STATUS_CHANGED,
          summary: `Vendor booking ${status === 'CONFIRMED' ? 'confirmed' : status === 'DECLINED' ? 'declined' : `set to ${status}`}`,
          wedding: { connect: { id: weddingId } },
          vendorBooking: { connect: { id: vendorBookingId } },
        },
        tx
      );

      if (status === 'CONFIRMED') {
        await maybeActivateWedding(weddingId, tx);
      }

      return updated;
    });
  },

  // Milestone 6 follow-up (2026-07-26 verification found the gap): the only
  // way a VendorBooking previously came to exist was convertBookingToWedding's
  // per-item loop (Track B, Booking-sourced weddings) — a CRM-sourced Wedding
  // had no path to ever get its first VendorBooking, so it could never reach
  // ACTIVE. Mirrors that same per-item block (VendorBooking + confirm Task +
  // ActivityLog, one transaction) rather than inventing a new shape.
  async addVendorBooking(
    weddingId: string,
    input: { weddingEventId: string; vendorId: string; agreedPrice: number },
    actorId: string | null
  ) {
    await findWeddingOrThrow(weddingId);

    const event = await weddingEventRepository.findById(input.weddingEventId);
    if (!event || event.weddingId !== weddingId) {
      throw new NotFoundError('WeddingEvent', input.weddingEventId);
    }

    const vendor = await vendorRepository.findById(input.vendorId);
    if (!vendor) throw new NotFoundError('Vendor', input.vendorId);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const vendorBooking = await vendorBookingRepository.create(
        {
          weddingEvent: { connect: { id: input.weddingEventId } },
          vendor: { connect: { id: input.vendorId } },
          agreedPrice: input.agreedPrice,
          status: 'PENDING_VENDOR_CONFIRMATION',
        },
        tx
      );

      await taskRepository.create(
        {
          context: 'WEDDING_TASK',
          title: `Confirm booking with ${vendor.name}`,
          priority: 'MEDIUM',
          wedding: { connect: { id: weddingId } },
          weddingEvent: { connect: { id: input.weddingEventId } },
          vendorBooking: { connect: { id: vendorBooking.id } },
        },
        tx
      );

      await activityLogRepository.create(
        {
          type: ActivityType.STATUS_CHANGED,
          summary: `Vendor booking added: ${vendor.name} (₹${input.agreedPrice.toLocaleString('en-IN')}), pending confirmation`,
          wedding: { connect: { id: weddingId } },
          vendorBooking: { connect: { id: vendorBooking.id } },
          performedBy: actorId ? { connect: { id: actorId } } : undefined,
        },
        tx
      );

      return vendorBooking;
    });
  },

  // Admin-only vendor lookup for the "Add Vendor Booking" picker. Deliberately
  // not vendorRepository.findMany/vendorService.search — same reasoning
  // getWorkspace's own vendor lookup already documents: those force a
  // packages/faqs include this picker doesn't need and don't expose category
  // as a plain string. /api/vendors can't be reused either — it's still
  // Mongo-backed (module cutover hasn't reached Vendors yet) and
  // VendorBooking.vendorId is a Postgres Vendor.id FK, not a Mongo _id.
  async searchVendors(q: string) {
    if (q.trim().length < 2) return [];
    const vendors = await prisma.vendor.findMany({
      where: { name: { contains: q.trim(), mode: 'insensitive' } },
      select: { id: true, name: true, city: true, category: { select: { name: true } } },
      orderBy: { name: 'asc' },
      take: 10,
    });
    return vendors.map((v) => ({ id: v.id, name: v.name, city: v.city, category: v.category.name }));
  },

  // Sprint 7.1 — Invoice is safe to make creatable now (an internal admin
  // record, same trust level as VendorBooking.agreedPrice: a coordinator
  // typing in a real number). Payment is not — its schema is Razorpay-shaped
  // (razorpayPaymentId/razorpayOrderId), so a fake "Create Payment" would
  // either lie about money that didn't move or invent a manual-payment
  // concept nothing has asked for. Payment creation waits for Sprint 7.2/7.5
  // (Razorpay integration); this method deliberately never touches it.
  async createInvoice(
    weddingId: string,
    input: {
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
    },
    actorId: string | null
  ) {
    const wedding = await findWeddingOrThrow(weddingId);

    // Server computes totals from line items — never trusts a client-sent
    // subtotal/total. gstAmount/discount stay admin-typed inputs (no
    // auto-calculated GST %), per docs/wedding-os/06-finance.md §5's flag
    // that GST treatment is a real compliance question, not to be defaulted.
    const subtotal = input.items.reduce((sum, i) => sum + i.amount * i.quantity, 0);
    const total = subtotal - input.discount + input.gstAmount;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const invoiceNumber = await generateInvoiceNumber(tx);
      const invoice = await invoiceRepository.create(
        {
          invoiceNumber,
          clientName: input.clientName,
          clientPhone: input.clientPhone,
          clientEmail: input.clientEmail,
          clientCity: input.clientCity,
          eventDate: input.eventDate,
          eventType: input.eventType,
          subtotal,
          discount: input.discount,
          gstEnabled: input.gstEnabled,
          gstAmount: input.gstAmount,
          total,
          notes: input.notes,
          status: 'DRAFT',
          customerId: wedding.customerId ?? undefined,
          wedding: { connect: { id: weddingId } },
          items: { create: input.items },
        },
        tx
      );

      await activityLogRepository.create(
        {
          type: ActivityType.STATUS_CHANGED,
          summary: `Invoice ${invoiceNumber} created (₹${total.toLocaleString('en-IN')})`,
          wedding: { connect: { id: weddingId } },
          performedBy: actorId ? { connect: { id: actorId } } : undefined,
        },
        tx
      );

      return invoice;
    });
  },

  async transitionStatus(weddingId: string, toStatus: WeddingStatus) {
    const wedding = await findWeddingOrThrow(weddingId);
    if (!canTransitionWedding(wedding.status, toStatus)) {
      throw new InvalidTransitionError(`Cannot move Wedding from ${wedding.status} to ${toStatus}`);
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await weddingRepository.update(
        weddingId,
        { status: toStatus, completedAt: toStatus === 'COMPLETED' ? new Date() : undefined },
        tx
      );
      await activityLogRepository.create(
        {
          type: ActivityType.STATUS_CHANGED,
          summary: `Wedding status changed: ${wedding.status} → ${toStatus}`,
          wedding: { connect: { id: weddingId } },
        },
        tx
      );
      return updated;
    });
  },
};
