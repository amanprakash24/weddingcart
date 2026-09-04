import { prisma } from '@/lib/prisma';
import { createPaymentLink } from '@/lib/razorpay';
import type { EventOrder } from '@/generated/prisma/client';

export const eventService = {
  async listAll() {
    return prisma.event.findMany({
      orderBy: { date: 'asc' },
      include: { passTypes: { orderBy: { price: 'asc' } } },
    });
  },

  async listPublished() {
    return prisma.event.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { date: 'asc' },
      include: { passTypes: { where: { status: 'ACTIVE' }, orderBy: { price: 'asc' } } },
    });
  },

  async getById(id: string) {
    return prisma.event.findUnique({
      where: { id },
      include: {
        passTypes: { orderBy: { price: 'asc' } },
        orders: { orderBy: { createdAt: 'desc' }, include: { tickets: { include: { passType: true } } } },
        tickets: { include: { passType: true }, orderBy: { createdAt: 'desc' } },
      },
    });
  },

  async getBySlug(slug: string) {
    return prisma.event.findUnique({
      where: { slug },
      include: {
        passTypes: { where: { status: 'ACTIVE' }, orderBy: { price: 'asc' } },
      },
    });
  },

  async create(input: {
    slug: string;
    name: string;
    date: string | Date;
    time?: string | null;
    venueName: string;
    venueAddress?: string | null;
    description?: string | null;
    coverImage?: string | null;
    capacity?: number | null;
    status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';
    passTypes: Array<{
      name: string;
      description?: string | null;
      price: number;
      peopleIncluded?: number | null;
      foodIncluded?: boolean | null;
      salesLimit?: number | null;
    }>;
  }) {
    return prisma.event.create({
      data: {
        slug: input.slug,
        name: input.name,
        date: new Date(input.date),
        time: input.time ?? null,
        venueName: input.venueName,
        venueAddress: input.venueAddress ?? null,
        description: input.description ?? '',
        coverImage: input.coverImage ?? '',
        capacity: input.capacity ?? null,
        status: input.status ?? 'DRAFT',
        passTypes: {
          create: input.passTypes.map((pass) => ({
            name: pass.name,
            description: pass.description ?? '',
            price: pass.price,
            peopleIncluded: pass.peopleIncluded ?? 1,
            foodIncluded: pass.foodIncluded ?? false,
            salesLimit: pass.salesLimit ?? null,
          })),
        },
      },
      include: { passTypes: true },
    });
  },

  async update(id: string, input: Partial<{
    slug: string;
    name: string;
    date: string | Date;
    time: string | null;
    venueName: string;
    venueAddress: string | null;
    description: string | null;
    coverImage: string | null;
    capacity: number | null;
    status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';
  }>) {
    return prisma.event.update({
      where: { id },
      data: {
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.date !== undefined ? { date: new Date(input.date) } : {}),
        ...(input.time !== undefined ? { time: input.time ?? null } : {}),
        ...(input.venueName !== undefined ? { venueName: input.venueName } : {}),
        ...(input.venueAddress !== undefined ? { venueAddress: input.venueAddress ?? null } : {}),
        ...(input.description !== undefined ? { description: input.description ?? '' } : {}),
        ...(input.coverImage !== undefined ? { coverImage: input.coverImage ?? '' } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: { passTypes: true },
    });
  },

  async createOrder(eventId: string, orderInput: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string | null;
    passTypeId: string;
    quantity?: number;
    paymentProvider?: string | null;
    paymentReference?: string | null;
    notes?: string | null;
  }): Promise<{ order: EventOrder; paymentUrl: string }> {
    const quantity = Math.max(1, orderInput.quantity ?? 1);

    const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { passTypes: true },
      });
    if (!event || event.status !== 'PUBLISHED') throw new Error('Event is not available for booking');

    const passType = event.passTypes.find((pass) => pass.id === orderInput.passTypeId && pass.status === 'ACTIVE');
    if (!passType) throw new Error('Pass type is unavailable');

    const soldCount = await prisma.eventTicket.count({
      where: { eventId, passTypeId: passType.id, order: { status: 'CONFIRMED' } },
    });
    if (passType.salesLimit !== null && soldCount + quantity > passType.salesLimit) {
      throw new Error('Sales limit reached for this pass type');
    }

    const total = passType.price * quantity;
    const order = await prisma.eventOrder.create({
        data: {
          eventId,
          passTypeId: passType.id,
          quantity,
          customerName: orderInput.customerName,
          customerPhone: orderInput.customerPhone,
          customerEmail: orderInput.customerEmail ?? null,
          amount: total,
          paymentProvider: orderInput.paymentProvider ?? 'RAZORPAY',
          paymentReference: orderInput.paymentReference ?? null,
          notes: orderInput.notes ?? null,
          status: 'PENDING',
        },
      });
    const payment = await createPaymentLink({
      invoiceId: order.id,
      amount: total * 100,
      clientName: orderInput.customerName,
      clientPhone: orderInput.customerPhone,
      clientEmail: orderInput.customerEmail ?? undefined,
      description: `${event.name} - ${passType.name}`,
      notes: { eventOrderId: order.id, eventId, passTypeId: passType.id, quantity: String(quantity) },
      allowDevelopmentFallback: false,
    });
    if (!payment.ok) {
      await prisma.eventOrder.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
      throw new Error(payment.error);
    }
    const updatedOrder = await prisma.eventOrder.update({
      where: { id: order.id },
      data: { razorpayPaymentLinkId: payment.razorpayPaymentLinkId, paymentReference: payment.razorpayPaymentLinkId },
    });
    return { order: updatedOrder, paymentUrl: payment.shortUrl };
  },

  async checkIn(eventId: string, ticketId: string) {
    return prisma.$transaction(async (tx) => {
      const ticket = await tx.eventTicket.findFirst({ where: { id: ticketId, eventId }, include: { order: true } });
      if (!ticket) throw new Error('Ticket not found');
      if (ticket.order.status !== 'CONFIRMED') throw new Error('Ticket is not paid and confirmed');
      if (ticket.checkInStatus === 'CANCELLED') throw new Error('Ticket is cancelled');
      if (ticket.checkInStatus === 'CHECKED_IN') throw new Error('Ticket has already been used');
      return tx.eventTicket.update({
        where: { id: ticketId },
        data: { checkInStatus: 'CHECKED_IN', checkedInAt: new Date() },
      });
    });
  },

  async handlePaymentWebhook(input: {
    event: string;
    eventId: string;
    paymentLinkId?: string;
    paymentId?: string;
    amount: number;
  }) {
    if (input.event !== 'payment_link.paid') return { handled: false };
    return prisma.$transaction(async (tx) => {
      const duplicate = await tx.eventWebhookEvent.findUnique({ where: { eventId: input.eventId } });
      if (duplicate) return { handled: true, duplicate: true };
      await tx.eventWebhookEvent.create({
        data: { provider: 'RAZORPAY', eventId: input.eventId, event: input.event },
      });
      if (!input.paymentLinkId || !input.paymentId) return { handled: false };
      const order = await tx.eventOrder.findUnique({ where: { razorpayPaymentLinkId: input.paymentLinkId } });
      if (!order) return { handled: false };
      if (order.status === 'CONFIRMED') return { handled: true, duplicate: true };
      if (order.amount * 100 !== input.amount) throw new Error('Payment amount does not match event order');
      await tx.eventOrder.update({
        where: { id: order.id },
        data: {
          status: 'PAYMENT_SUCCESS',
          razorpayPaymentId: input.paymentId,
          paidAt: new Date(),
        },
      });
      const updated = await tx.eventOrder.update({
        where: { id: order.id },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      });
      for (let i = 0; i < order.quantity; i += 1) {
        await tx.eventTicket.create({
          data: {
            eventId: order.eventId,
            orderId: order.id,
            passTypeId: order.passTypeId,
            ticketCode: `${order.id}-${i + 1}`.toUpperCase(),
            qrCode: `${order.id}:${i + 1}`,
            attendeeName: order.customerName,
            attendeePhone: order.customerPhone,
          },
        });
      }
      return { handled: true, order: updated };
    });
  },
};
