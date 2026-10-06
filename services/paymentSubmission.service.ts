import type { Prisma } from '@/generated/prisma/client';
import { ActivityType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { subjectCreateData } from '@/lib/crm/subject';
import type { AgreementMoneyView } from '@/lib/commercial/view';
import {
  PENDING_MAX,
  checkProof,
  toProposalPayments,
  validatePaymentClaim,
  type ProposalPayments,
} from '@/lib/payments/customerPayment';
import { upiPayeeFrom } from '@/lib/payments/upi';
import { deleteProof, signedProofUrl, uploadProof, type StoredProof } from '@/lib/payments/proofStorage';
import { resolveUserNames } from '@/lib/users';
import { activityLogRepository } from '@/repositories/activityLog.repository';
import { loadAgreementMoney } from '@/services/agreement.service';
import { recordPaymentForQuotation, type PaymentOutcome } from '@/services/commercialFlow.service';
import type { SourceType } from '@/services/leadInbox.service';

// Roadmap 1.3 (docs/wedding-os/08-quotation.md §20) — "I have paid" from the couple's proposal link, and staff verifying it.
//
// A submission is a claim. It never counts as money, never starts the 7-day hold and never confirms anything. Verifying it records the
// Payment through recordPaymentForQuotation — the same path as a payment staff type in — with the UTR as its reference and
// "sub-<submission id>" as its idempotency key. So the 25% rule, the hold (dated from when the couple paid), auto-confirmation and
// "the same UTR is never counted twice" all stay where they are, and a verify that failed half-way is safe to press again.

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const REJECT_REASON_MAX = 300;

type Tx = Prisma.TransactionClient;
type Subject = { leadId: string | null; enquiryId: string | null; consultationId: string | null };

function sourceOf(q: Subject): { sourceType: SourceType; sourceId: string } {
  if (q.leadId) return { sourceType: 'LEAD', sourceId: q.leadId };
  if (q.enquiryId) return { sourceType: 'ENQUIRY', sourceId: q.enquiryId };
  return { sourceType: 'CONSULTATION', sourceId: q.consultationId as string };
}

// Once the wedding exists the money story belongs to it; before that, to the lead the quotation is for (as agreement.service does).
const timelineOf = (q: Subject, weddingId: string | null) =>
  weddingId ? { wedding: { connect: { id: weddingId } } } : subjectCreateData(sourceOf(q).sourceType, sourceOf(q).sourceId);

export interface PaymentSubmissionDeps {
  db: Pick<typeof prisma, '$transaction'> & {
    paymentSubmission: Pick<typeof prisma.paymentSubmission, 'findMany' | 'findUnique' | 'count' | 'updateMany'>;
    payment: Pick<typeof prisma.payment, 'findFirst'>;
    quotation: Pick<typeof prisma.quotation, 'findUnique'>;
  };
  loadMoney: (quotationId: string) => Promise<AgreementMoneyView>;
  recordPayment: typeof recordPaymentForQuotation;
  logActivity: typeof activityLogRepository.create;
  upload: (bytes: Buffer) => Promise<StoredProof>;
  removeProof: (publicId: string) => Promise<void>;
  proofUrl: (proof: StoredProof) => string;
  userNames: typeof resolveUserNames;
  env: () => { SHAADI_UPI_ID?: string; SHAADI_UPI_NAME?: string };
  now: () => Date;
}

const defaultDeps = (): PaymentSubmissionDeps => ({
  db: prisma,
  loadMoney: (id) => loadAgreementMoney(id),
  recordPayment: (...a) => recordPaymentForQuotation(...a),
  logActivity: activityLogRepository.create,
  upload: uploadProof,
  removeProof: deleteProof,
  proofUrl: (p) => signedProofUrl(p),
  userNames: resolveUserNames,
  env: () => ({ SHAADI_UPI_ID: process.env.SHAADI_UPI_ID, SHAADI_UPI_NAME: process.env.SHAADI_UPI_NAME }),
  now: () => new Date(),
});

export interface StaffSubmission {
  id: string;
  amount: number;
  method: string;
  utr: string;
  paidOn: string | null;
  note: string | null;
  proofUrl: string | null; // signed, expires in minutes
  proofIsPdf: boolean;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectReason: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  receiptId: string | null;
  submittedAt: string;
}

export interface ProofFile {
  bytes: Buffer;
  type: string;
  size: number;
}

export function createPaymentSubmissionService(deps: PaymentSubmissionDeps = defaultDeps()) {
  async function utrAlreadyUsed(client: Pick<PaymentSubmissionDeps['db'], 'paymentSubmission' | 'payment'> | Tx, quotationId: string, utr: string): Promise<boolean> {
    const claimed = await client.paymentSubmission.count({ where: { quotationId, utr, status: { in: ['PENDING', 'VERIFIED'] } } });
    if (claimed > 0) return true;
    const paid = await client.payment.findFirst({ where: { reference: { equals: utr, mode: 'insensitive' }, invoice: { quotationId } }, select: { id: true } });
    return paid !== null;
  }

  return {
    // The Payments section of an ACCEPTED proposal. Read-only: nothing is created (the agreement is made by the first payment or the
    // booking, never by the couple opening the link).
    async forProposal(quotationId: string): Promise<ProposalPayments> {
      const money = await deps.loadMoney(quotationId);
      const subs = await deps.db.paymentSubmission.findMany({ where: { quotationId }, select: { id: true, amount: true, utr: true, createdAt: true, status: true, rejectReason: true } });
      return toProposalPayments(money, subs, upiPayeeFrom(deps.env()));
    },

    // "I have paid". The caller (proposal.service) has already resolved the link and checked the proposal is ACCEPTED.
    async submit(quotation: Subject & { id: string; quotationNumber: string }, raw: { amount: unknown; utr: unknown; paidOn?: unknown; note?: unknown }, proof: ProofFile | null): Promise<{ submitted: true }> {
      if (!upiPayeeFrom(deps.env())) throw new ConflictError('Online payment is not available yet — please call us');
      const money = await deps.loadMoney(quotation.id);
      const claim = validatePaymentClaim(raw, { outstanding: money.outstanding, now: deps.now() });
      const proofProblem = checkProof(proof);
      if (proofProblem) throw new ValidationError(proofProblem);

      // Checked before the upload (so a refused claim never stores a file) and again under the lock below.
      if ((await deps.db.paymentSubmission.count({ where: { quotationId: quotation.id, status: 'PENDING' } })) >= PENDING_MAX)
        throw new ConflictError('We are still checking your earlier payments — please wait for us, or call us');
      if (await utrAlreadyUsed(deps.db, quotation.id, claim.utr)) throw new ConflictError('This UTR has already been sent to us — no need to send it again');

      const stored = proof && proof.size > 0 ? await deps.upload(proof.bytes) : null;
      try {
        await deps.db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "quotations" WHERE "id" = ${quotation.id} FOR UPDATE`;
          if ((await tx.paymentSubmission.count({ where: { quotationId: quotation.id, status: 'PENDING' } })) >= PENDING_MAX)
            throw new ConflictError('We are still checking your earlier payments — please wait for us, or call us');
          if (await utrAlreadyUsed(tx, quotation.id, claim.utr)) throw new ConflictError('This UTR has already been sent to us — no need to send it again');
          await tx.paymentSubmission.create({
            data: { quotationId: quotation.id, amount: claim.amount, method: 'UPI', utr: claim.utr, paidOn: claim.paidOn, note: claim.note, proofPublicId: stored?.publicId ?? null, proofFormat: stored?.format ?? null },
          });
          await deps.logActivity(
            {
              type: ActivityType.PAYMENT_SUBMITTED,
              summary: `The couple says they paid ${inr(claim.amount)} by UPI for ${quotation.quotationNumber} (UTR ${claim.utr})${stored ? ', with a screenshot' : ''} — check the bank and verify it`,
              detail: claim.note ?? undefined,
              ...timelineOf(quotation, money.weddingId),
            },
            tx
          );
        });
      } catch (err) {
        if (stored) await deps.removeProof(stored.publicId);
        throw err;
      }
      return { submitted: true };
    },

    // Staff: the claims on one agreement, newest first, with a short-lived link to each screenshot.
    async listForQuotation(quotationId: string): Promise<StaffSubmission[]> {
      const subs = await deps.db.paymentSubmission.findMany({ where: { quotationId }, orderBy: { createdAt: 'desc' } });
      const names = await deps.userNames(subs.map((s) => s.reviewedById));
      return subs.map((s) => ({
        id: s.id,
        amount: s.amount,
        method: s.method,
        utr: s.utr,
        paidOn: s.paidOn?.toISOString() ?? null,
        note: s.note,
        proofUrl: s.proofPublicId && s.proofFormat ? deps.proofUrl({ publicId: s.proofPublicId, format: s.proofFormat }) : null,
        proofIsPdf: s.proofFormat === 'pdf',
        status: s.status,
        rejectReason: s.rejectReason,
        reviewedAt: s.reviewedAt?.toISOString() ?? null,
        reviewedByName: s.reviewedById ? (names.get(s.reviewedById) ?? null) : null,
        receiptId: s.receiptId,
        submittedAt: s.createdAt.toISOString(),
      }));
    },

    // Staff matched the money in the bank. The amount (and date) may be corrected to what actually arrived.
    async verify(quotationId: string, submissionId: string, input: { amount?: number; paidAt?: Date | null }, actorId: string | null): Promise<PaymentOutcome & { alreadyVerified: boolean }> {
      const sub = await deps.db.paymentSubmission.findUnique({ where: { id: submissionId } });
      if (!sub || sub.quotationId !== quotationId) throw new NotFoundError('Payment submission', submissionId);
      if (sub.status === 'REJECTED') throw new ConflictError('This payment was marked as not matched — ask the couple to send it again');
      const wasVerified = sub.status === 'VERIFIED';

      const outcome = await deps.recordPayment(
        quotationId,
        { amount: input.amount ?? sub.amount, method: 'UPI', reference: sub.utr, paidAt: input.paidAt ?? sub.paidOn ?? sub.createdAt, idempotencyKey: `sub-${sub.id}` },
        actorId
      );
      // Conditional: two people verifying at once both get the same receipt, and the row is written once.
      const updated = await deps.db.paymentSubmission.updateMany({
        where: { id: sub.id, status: 'PENDING' },
        data: { status: 'VERIFIED', receiptId: outcome.receiptId, reviewedAt: deps.now(), reviewedById: actorId },
      });
      return { ...outcome, alreadyVerified: wasVerified || updated.count === 0 };
    },

    // Staff could not find the money. The reason is shown to the couple on their link.
    async reject(quotationId: string, submissionId: string, reason: unknown, actorId: string | null): Promise<{ rejected: true }> {
      const text = typeof reason === 'string' ? reason.trim() : '';
      if (text.length < 3) throw new ValidationError('Say why it could not be matched — the couple will see this');
      if (text.length > REJECT_REASON_MAX) throw new ValidationError(`Please keep it under ${REJECT_REASON_MAX} characters`);
      const quotation = await deps.db.quotation.findUnique({ where: { id: quotationId }, select: { quotationNumber: true, leadId: true, enquiryId: true, consultationId: true } });
      if (!quotation) throw new NotFoundError('Quotation', quotationId);

      await deps.db.$transaction(async (tx) => {
        const sub = await tx.paymentSubmission.findUnique({ where: { id: submissionId } });
        if (!sub || sub.quotationId !== quotationId) throw new NotFoundError('Payment submission', submissionId);
        const updated = await tx.paymentSubmission.updateMany({ where: { id: submissionId, status: 'PENDING' }, data: { status: 'REJECTED', rejectReason: text, reviewedAt: deps.now(), reviewedById: actorId } });
        if (updated.count !== 1) throw new ConflictError(sub.status === 'VERIFIED' ? 'This payment was already verified' : 'This payment was already marked as not matched');
        const money = await deps.loadMoney(quotationId);
        await deps.logActivity(
          {
            type: ActivityType.PAYMENT_SUBMISSION_REJECTED,
            summary: `Payment of ${inr(sub.amount)} (UTR ${sub.utr}) for ${quotation.quotationNumber} could not be matched`,
            detail: text,
            performedBy: actorId ? { connect: { id: actorId } } : undefined,
            ...timelineOf(quotation, money.weddingId),
          },
          tx
        );
      });
      return { rejected: true };
    },
  };
}

export const paymentSubmissionService = createPaymentSubmissionService();
