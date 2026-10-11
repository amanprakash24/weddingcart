import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { buildAgreementMoney } from '@/lib/commercial/view';
import { currentBusiness } from '@/lib/ownership/business';
import { buildCollections, type CollectionRow, type VenueCollections } from '@/lib/venue/collections';

// "Money to collect" (Vendor OS → Payments): every booking the business made with its OWN couples, with what was agreed, what was
// received and what is still owed. Read-only. Always called inside the business's scope (lib/ownership/venueEntry.ts): the database
// guard limits the read to that business's quotations, so nothing of another business's — or of Shaadi Shopping's — is in it.
//
// No second set of sums: each booking's figures are the Money v1 builder's (lib/commercial/view.ts), from the frozen agreement and
// the payments actually recorded — the same builder behind the enquiry's own money card (services/agreement.service.ts
// `loadAgreementMoney`), so the list and the enquiry never disagree. Here it is fed from ONE query for all bookings.
//
// Left out: an enquiry marked "Not going ahead" and a cancelled wedding — nothing is being collected for those.

const istDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);

export interface VenueCollectionsDeps {
  db: { quotation: Pick<typeof prisma.quotation, 'findMany'> };
  business: typeof currentBusiness;
  now: () => Date;
}

const defaultDeps = (): VenueCollectionsDeps => ({ db: prisma, business: currentBusiness, now: () => new Date() });

const SELECT = {
  id: true,
  quotationNumber: true,
  consultation: { select: { id: true, name: true, phone: true, weddingDate: true, pipelineStage: true } },
  agreement: { select: { bookingId: true, agreementTotal: true, confirmationPercent: true, confirmationAmount: true, holdWindowDays: true, holdStartedAt: true, confirmedAt: true } },
  booking: { select: { status: true, weddingDate: true, wedding: { select: { id: true, status: true, primaryDate: true } } } },
  invoices: {
    where: { kind: { in: ['ADVANCE', 'BALANCE'] } },
    select: { id: true, invoiceNumber: true, kind: true, status: true, total: true, weddingId: true, payments: { select: { id: true, amount: true, method: true, status: true, paidAt: true } } },
  },
  _count: { select: { paymentSubmissions: { where: { status: 'PENDING' } } } },
} satisfies Prisma.QuotationSelect;

export function createVenueCollectionsService(deps: VenueCollectionsDeps = defaultDeps()) {
  return {
    async get(): Promise<VenueCollections> {
      const now = deps.now();
      const business = await deps.business();
      const quotations = await deps.db.quotation.findMany({
        where: { status: 'ACCEPTED', consultationId: { not: null }, agreement: { isNot: null } },
        select: SELECT,
        orderBy: { acceptedAt: 'desc' },
        take: 500,
      });
      const rows: CollectionRow[] = [];
      for (const q of quotations) {
        const { consultation: c, agreement, booking } = q;
        if (!c || !agreement || c.pipelineStage === 'LOST' || booking?.wedding?.status === 'CANCELLED') continue;
        const weddingId = booking?.wedding?.id ?? q.invoices.find((i) => i.weddingId)?.weddingId ?? null;
        const money = buildAgreementMoney({
          quotationId: q.id,
          quotationNumber: q.quotationNumber,
          agreement,
          invoices: q.invoices,
          bookingConfirmed: weddingId !== null || agreement.confirmedAt !== null || booking?.status === 'CONFIRMED',
          weddingId,
          now,
        });
        rows.push({
          enquiryId: c.id,
          customerName: c.name,
          phone: c.phone,
          // The wedding's own date once it exists (the business may have moved it), else the booking's, else what the enquiry says.
          weddingDate: booking?.wedding ? istDay(booking.wedding.primaryDate) : booking?.weddingDate ? istDay(booking.weddingDate) : c.weddingDate || null,
          quotationNumber: q.quotationNumber,
          weddingId,
          total: money.agreementTotal,
          received: money.received,
          outstanding: money.outstanding,
          confirmed: money.bookingConfirmed,
          toConfirmRemaining: money.remaining,
          stateLabel: money.stateLabel,
          claimsToCheck: q._count.paymentSubmissions,
          payments: money.payments.map((p) => ({ amount: p.amount, paidAt: p.paidAt })),
        });
      }
      return buildCollections(rows, now, { name: business.name, payOnLink: !!business.upiId });
    },
  };
}

export const venueCollectionsService = createVenueCollectionsService();
