import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { PLATFORM_BUSINESS_ID } from '@/lib/ownership/owned';
import { upiPayeeOf, type UpiPayee } from '@/lib/payments/upi';
import type { ProofFile } from '@/services/paymentSubmission.service';
import { paymentSubmissionService } from '@/services/paymentSubmission.service';

// "I have paid" inside My Wedding (22 Nov 2026, PR E2). Once the booking became a wedding, the couple sends payment details here
// (signed in) instead of through the open proposal link. Same rules as the link (services/paymentSubmission.service.ts): a claim
// is never money — staff verify it against the bank; the same UTR is never accepted twice; a few claims at most wait at once.
// Callers run this inside asCoupleWedding, so only the couple's own wedding is reachable.

async function bookedQuotation(weddingId: string) {
  const w = await prisma.wedding.findUnique({
    where: { id: weddingId },
    select: { businessId: true, sourceBooking: { select: { quotationId: true } }, business: { select: { name: true, upiId: true, upiName: true } } },
  });
  if (!w) throw new NotFoundError('Wedding', weddingId);
  const quotationId =
    w.sourceBooking?.quotationId ?? (await prisma.invoice.findFirst({ where: { weddingId, quotationId: { not: null } }, select: { quotationId: true } }))?.quotationId ?? null;
  if (!quotationId) return null;
  const quotation = await prisma.quotation.findUnique({ where: { id: quotationId }, select: { id: true, quotationNumber: true, leadId: true, enquiryId: true, consultationId: true } });
  if (!quotation) return null;
  // Who is paid: Shaadi Shopping's own UPI on its weddings (undefined = the service reads it from the server env), the venue's own
  // on a venue's wedding (null = the venue has not said — no claim can be sent, the couple is pointed to the venue).
  const payTo: UpiPayee | null | undefined = w.businessId === PLATFORM_BUSINESS_ID ? undefined : upiPayeeOf({ upiId: w.business.upiId, upiName: w.business.upiName, name: w.business.name });
  return { quotation, payTo, businessName: w.business.name, isPlatform: w.businessId === PLATFORM_BUSINESS_ID };
}

export const coupleMoneyService = {
  // The couple's claims (waiting / could not be matched) and whether they can send another.
  async claims(weddingId: string) {
    const b = await bookedQuotation(weddingId);
    if (!b || b.payTo === null) return { canClaim: false, claims: [], inReview: 0 };
    const view = await paymentSubmissionService.forProposal(b.quotation.id, b.payTo);
    return { canClaim: view.canSubmit && !!view.upi, claims: view.submissions, inReview: view.inReview };
  },

  async submitClaim(weddingId: string, raw: { amount: unknown; utr: unknown; paidOn?: unknown; note?: unknown }, proof: ProofFile | null) {
    const b = await bookedQuotation(weddingId);
    if (!b) throw new ConflictError('There is no booking to pay against yet — please call us');
    if (b.payTo === null) throw new ConflictError(`Please contact ${b.businessName} about your payment`);
    await paymentSubmissionService.submit(b.quotation, raw, proof, b.payTo);
    return this.claims(weddingId);
  },
};
