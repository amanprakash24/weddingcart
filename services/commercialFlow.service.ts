import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { bookingService } from '@/services/booking.service';
import { loadAgreementMoney, recordAgreementPayment, type RecordAgreementPaymentInput } from '@/services/agreement.service';
import { findAgreementForWedding } from '@/services/invoiceWorkflow.service';
import { convertBookingToWedding } from '@/services/weddingConversion.service';

// Recording a payment, and what follows from it (Money v1). The payment itself is one transaction (agreement.service.ts); confirming
// the booking and creating the wedding is a separate, heavier step that runs AFTER it commits — a payment already received is never
// rolled back because the wedding could not be set up, and the ordinary "Confirm booking" button remains the safe retry.
//
// The booking path confirms automatically once the confirmation amount is in (the wedding then comes from the existing conversion,
// which is idempotent). A CRM lead has no booking to confirm: it becomes "ready", and staff create the wedding (their dialog asks for
// the date and city the wedding needs).

export interface PaymentOutcome {
  receiptId: string;
  duplicate: boolean;
  splits: { invoiceNumber: string; amount: number }[];
  confirmation: { attempted: boolean; confirmed: boolean; weddingId: string | null; error: string | null };
  money: Awaited<ReturnType<typeof loadAgreementMoney>>;
}

export async function recordPaymentForQuotation(quotationId: string, input: RecordAgreementPaymentInput, actorId: string | null): Promise<PaymentOutcome> {
  const receipt = await recordAgreementPayment(quotationId, input, actorId);
  let money = await loadAgreementMoney(quotationId);
  const confirmation: PaymentOutcome['confirmation'] = { attempted: false, confirmed: false, weddingId: money.weddingId, error: null };

  if (money.readyToConfirm && money.bookingId) {
    confirmation.attempted = true;
    try {
      await bookingService.update(money.bookingId, { status: 'CONFIRMED' }); // the central gate re-checks the amount
      const wedding = await convertBookingToWedding(money.bookingId);
      confirmation.confirmed = true;
      confirmation.weddingId = wedding.id;
    } catch (err) {
      confirmation.error = err instanceof Error ? err.message : 'Could not confirm the booking';
    }
    money = await loadAgreementMoney(quotationId);
  }
  return { ...receipt, confirmation, money };
}

// Money tab: the wedding's own agreement.
export async function recordPaymentForWedding(weddingId: string, input: RecordAgreementPaymentInput, actorId: string | null): Promise<PaymentOutcome> {
  const wedding = await prisma.wedding.findUnique({ where: { id: weddingId } });
  if (!wedding) throw new NotFoundError('Wedding', weddingId);
  const found = await findAgreementForWedding(prisma, wedding);
  if (!found) throw new NotFoundError('Accepted quotation for wedding', weddingId);
  return recordPaymentForQuotation(found.quotation.id, input, actorId);
}
