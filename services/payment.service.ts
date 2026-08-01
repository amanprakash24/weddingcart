import { prisma } from '@/lib/prisma';
import { Prisma, ActivityType } from '@/generated/prisma/client';
import type { PaymentLink } from '@/generated/prisma/client';
import { invoiceRepository, type InvoiceWithDetails } from '@/repositories/invoice.repository';
import { paymentRepository } from '@/repositories/payment.repository';
import { paymentLinkRepository } from '@/repositories/paymentLink.repository';
import { activityLogRepository } from '@/repositories/activityLog.repository';
import { createPaymentLink as createRazorpayPaymentLink } from '@/lib/razorpay';
import { NotFoundError } from '@/lib/errors';

type Tx = Prisma.TransactionClient;

// Razorpay webhook payload shapes — only the fields this route actually
// reads, not a full SDK-style type (no SDK is installed, per Sprint 7.2's
// raw-fetch decision — see lib/razorpay.ts).
interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id?: string;
        amount: number; // paise
        method: string;
        notes?: { invoiceId?: string };
      };
    };
    payment_link?: {
      entity: {
        id: string;
        notes?: { invoiceId?: string };
      };
    };
  };
}

function invoiceAmountPaid(invoice: InvoiceWithDetails): number {
  return invoice.payments.filter((p) => p.status === 'SUCCESS').reduce((sum, p) => sum + p.amount, 0);
}

async function createPayment(
  tx: Tx,
  invoiceId: string,
  payment: { amount: number; method: string; razorpayPaymentId: string; razorpayOrderId?: string }
) {
  return paymentRepository.create(
    {
      invoice: { connect: { id: invoiceId } },
      amount: payment.amount,
      method: payment.method,
      razorpayPaymentId: payment.razorpayPaymentId,
      razorpayOrderId: payment.razorpayOrderId,
      status: 'SUCCESS',
    },
    tx
  );
}

async function markLinkPaid(tx: Tx, razorpayPaymentLinkId: string | undefined) {
  if (!razorpayPaymentLinkId) return;
  const link = await paymentLinkRepository.findByRazorpayId(razorpayPaymentLinkId, tx);
  if (link && link.status === 'CREATED') {
    await paymentLinkRepository.update(link.id, { status: 'PAID' }, tx);
  }
}

async function updateInvoiceStatusIfSettled(tx: Tx, invoice: InvoiceWithDetails, newPaymentAmount: number) {
  const amountPaid = invoiceAmountPaid(invoice) + newPaymentAmount;
  if (amountPaid >= invoice.total) {
    await invoiceRepository.update(invoice.id, { status: 'PAID' }, tx);
  }
}

export const paymentService = {
  async createPaymentLinkForInvoice(weddingId: string, invoiceId: string, actorId: string | null): Promise<PaymentLink> {
    const invoice = await invoiceRepository.findById(invoiceId);
    if (!invoice || invoice.weddingId !== weddingId) {
      throw new NotFoundError('Invoice', invoiceId);
    }

    // Server computes the amount to charge — never trusts a client value,
    // same rule createInvoice() follows for subtotal/total.
    const outstanding = invoice.total - invoiceAmountPaid(invoice);

    const result = await createRazorpayPaymentLink({
      invoiceId: invoice.id,
      amount: outstanding * 100, // rupees -> paise (this schema stores rupees, Razorpay wants paise)
      clientName: invoice.clientName,
      clientPhone: invoice.clientPhone,
      clientEmail: invoice.clientEmail ?? undefined,
      description: `Invoice ${invoice.invoiceNumber}`,
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    return prisma.$transaction(async (tx) => {
      const link = await paymentLinkRepository.create(
        {
          invoice: { connect: { id: invoice.id } },
          razorpayPaymentLinkId: result.razorpayPaymentLinkId,
          shortUrl: result.shortUrl,
          amount: outstanding,
          createdBy: actorId ? { connect: { id: actorId } } : undefined,
        },
        tx
      );

      await activityLogRepository.create(
        {
          type: ActivityType.STATUS_CHANGED,
          summary: `Payment link sent for ₹${outstanding.toLocaleString('en-IN')}`,
          wedding: { connect: { id: weddingId } },
          performedBy: actorId ? { connect: { id: actorId } } : undefined,
        },
        tx
      );

      return link;
    });
  },

  async handleWebhookEvent(payload: RazorpayWebhookPayload): Promise<{ handled: boolean }> {
    if (payload.event === 'payment_link.expired') {
      const linkId = payload.payload.payment_link?.entity.id;
      if (!linkId) return { handled: false };
      await prisma.$transaction(async (tx) => {
        const link = await paymentLinkRepository.findByRazorpayId(linkId, tx);
        if (link && link.status === 'CREATED') {
          await paymentLinkRepository.update(link.id, { status: 'EXPIRED' }, tx);
        }
      });
      return { handled: true };
    }

    if (payload.event === 'payment.failed') {
      // A failed attempt against a Payment Link isn't money that moved —
      // logged only, no Payment row written for it.
      const invoiceId = payload.payload.payment?.entity.notes?.invoiceId;
      if (!invoiceId) return { handled: false };
      const invoice = await invoiceRepository.findById(invoiceId);
      if (invoice?.weddingId) {
        await activityLogRepository.create({
          type: ActivityType.STATUS_CHANGED,
          summary: `Payment attempt failed for invoice ${invoice.invoiceNumber}`,
          wedding: { connect: { id: invoice.weddingId } },
        });
      }
      return { handled: true };
    }

    if (payload.event !== 'payment_link.paid') {
      return { handled: false };
    }

    const paymentEntity = payload.payload.payment?.entity;
    const linkEntity = payload.payload.payment_link?.entity;
    if (!paymentEntity) return { handled: false };

    // Idempotency: razorpayPaymentId is @unique — a replayed webhook for a
    // payment already recorded is a true no-op, not a duplicate write.
    const existing = await paymentRepository.findMany({ where: { razorpayPaymentId: paymentEntity.id }, take: 1 });
    if (existing.data.length > 0) {
      return { handled: true };
    }

    const invoiceId = paymentEntity.notes?.invoiceId ?? linkEntity?.notes?.invoiceId;
    if (!invoiceId) return { handled: false };

    const invoice = await invoiceRepository.findById(invoiceId);
    if (!invoice?.weddingId) return { handled: false };

    const amountRupees = paymentEntity.amount / 100;

    await prisma.$transaction(async (tx) => {
      await createPayment(tx, invoice.id, {
        amount: amountRupees,
        method: paymentEntity.method,
        razorpayPaymentId: paymentEntity.id,
        razorpayOrderId: paymentEntity.order_id,
      });

      await markLinkPaid(tx, linkEntity?.id);
      await updateInvoiceStatusIfSettled(tx, invoice, amountRupees);

      await activityLogRepository.create(
        {
          type: ActivityType.PAYMENT_RECEIVED,
          summary: `Payment received: ₹${amountRupees.toLocaleString('en-IN')} via ${paymentEntity.method}`,
          wedding: { connect: { id: invoice.weddingId! } },
        },
        tx
      );
    });

    return { handled: true };
  },
};
