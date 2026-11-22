// The couple's payment plan on My Wedding (22 Nov 2026). Built only from what is really agreed:
//   1. the booking amount — the frozen confirmation amount of the accepted quotation (e.g. 25 %), and
//   2. the balance — everything after it.
// There is no instalment schedule in the system yet, so the balance has NO due date and is never presented as "the next payment":
// the couple is told the dates come from their expert. Until the booking amount is fully received, what confirms the booking is
// the one honest "next" amount.

export type PlanStepStatus = 'PAID' | 'PART_PAID' | 'DUE';

export interface PlanStep {
  key: 'BOOKING' | 'BALANCE';
  label: string;
  amount: number;
  paid: number;
  remaining: number;
  status: PlanStepStatus;
  note: string | null;
}

export interface PaymentPlan {
  agreed: number;
  received: number;
  due: number;
  steps: PlanStep[];
  // Only set when there is a real, agreed amount to pay next (the rest of the booking amount). Null = no fixed next amount.
  next: { amount: number; label: string } | null;
}

const statusOf = (amount: number, paid: number): PlanStepStatus => (paid >= amount ? 'PAID' : paid > 0 ? 'PART_PAID' : 'DUE');

export function paymentPlan(input: { agreed: number; received: number; confirmationAmount: number | null; confirmationPercent: number | null }): PaymentPlan {
  const agreed = Math.max(0, input.agreed);
  const received = Math.max(0, input.received);
  const due = Math.max(0, agreed - received);
  const steps: PlanStep[] = [];
  const booking = input.confirmationAmount && input.confirmationAmount > 0 ? Math.min(input.confirmationAmount, agreed) : 0;

  if (booking > 0) {
    const paid = Math.min(received, booking);
    steps.push({
      key: 'BOOKING',
      label: input.confirmationPercent ? `Booking amount (${input.confirmationPercent}%)` : 'Booking amount',
      amount: booking,
      paid,
      remaining: booking - paid,
      status: statusOf(booking, paid),
      note: paid >= booking ? 'Your booking is confirmed' : 'Confirms your booking',
    });
  }
  const balance = agreed - booking;
  if (balance > 0) {
    const paid = Math.max(0, Math.min(balance, received - booking));
    steps.push({
      key: 'BALANCE',
      label: booking > 0 ? 'Balance' : 'Total',
      amount: balance,
      paid,
      remaining: balance - paid,
      status: statusOf(balance, paid),
      note: paid >= balance ? null : 'Payment dates will be shared by your expert',
    });
  }
  const bookingStep = steps.find((s) => s.key === 'BOOKING');
  const next = bookingStep && bookingStep.remaining > 0 ? { amount: bookingStep.remaining, label: 'To confirm your booking' } : null;
  return { agreed, received, due, steps, next };
}
