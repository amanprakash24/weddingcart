import { allocate } from '@/lib/money/schedule';

// The couple's payment plan on My Wedding (22 Nov 2026). Built only from what is really agreed:
//   1. the booking amount — the frozen confirmation amount of the accepted quotation (e.g. 25 %), and
//   2. the balance — everything after it: either the dated instalments staff set (the payment schedule), or, with no schedule
//      yet, one "Balance" step with no date, which is never presented as "the next payment".
// Money received goes to the booking amount first, then to the instalments in date order (lib/money/schedule.ts: allocate).

export type PlanStepStatus = 'PAID' | 'PART_PAID' | 'DUE' | 'OVERDUE';

export interface PlanStep {
  key: string; // 'BOOKING', 'BALANCE', or 'INSTALMENT-<n>'
  label: string;
  amount: number;
  paid: number;
  remaining: number;
  status: PlanStepStatus;
  dueDate: string | null; // YYYY-MM-DD; null for the booking amount and an unscheduled balance
  note: string | null;
}

export interface PaymentPlan {
  agreed: number;
  received: number;
  due: number;
  scheduled: boolean; // staff have set dated instalments
  steps: PlanStep[];
  // Only set when there is a real, agreed amount to pay next: the rest of the booking amount, or the next instalment (with its
  // date). Null = nothing fixed to pay next (no schedule yet, or everything is paid).
  next: { amount: number; label: string; dueDate: string | null } | null;
}

const statusOf = (amount: number, paid: number): PlanStepStatus => (paid >= amount ? 'PAID' : paid > 0 ? 'PART_PAID' : 'DUE');

export function paymentPlan(input: {
  agreed: number;
  received: number;
  confirmationAmount: number | null;
  confirmationPercent: number | null;
  instalments?: { label: string; amount: number; dueDate: string }[];
  today?: string; // YYYY-MM-DD India date, for overdue instalments
}): PaymentPlan {
  const agreed = Math.max(0, input.agreed);
  const received = Math.max(0, input.received);
  const due = Math.max(0, agreed - received);
  const booking = input.confirmationAmount && input.confirmationAmount > 0 ? Math.min(input.confirmationAmount, agreed) : 0;
  const bookingLabel = input.confirmationPercent ? `Booking amount (${input.confirmationPercent}%)` : 'Booking amount';
  const instalments = input.instalments ?? [];

  if (instalments.length > 0) {
    const raw = [...(booking > 0 ? [{ label: bookingLabel, amount: booking, dueDate: null }] : []), ...instalments.map((i) => ({ label: i.label, amount: i.amount, dueDate: i.dueDate }))];
    const allocated = allocate(raw, received, input.today ?? '0000-00-00');
    const steps: PlanStep[] = allocated.map((s, i) => {
      const isBooking = booking > 0 && i === 0;
      return {
        key: isBooking ? 'BOOKING' : `INSTALMENT-${booking > 0 ? i : i + 1}`,
        label: s.label,
        amount: s.amount,
        paid: s.paid,
        remaining: s.remaining,
        status: s.status,
        dueDate: s.dueDate,
        note: isBooking ? (s.remaining === 0 ? 'Your booking is confirmed' : 'Confirms your booking') : null,
      };
    });
    const first = steps.find((s) => s.remaining > 0);
    return {
      agreed,
      received,
      due,
      scheduled: true,
      steps,
      next: first ? { amount: first.remaining, label: first.key === 'BOOKING' ? 'To confirm your booking' : first.label, dueDate: first.dueDate } : null,
    };
  }

  const steps: PlanStep[] = [];
  if (booking > 0) {
    const paid = Math.min(received, booking);
    steps.push({ key: 'BOOKING', label: bookingLabel, amount: booking, paid, remaining: booking - paid, status: statusOf(booking, paid), dueDate: null, note: paid >= booking ? 'Your booking is confirmed' : 'Confirms your booking' });
  }
  const balance = agreed - booking;
  if (balance > 0) {
    const paid = Math.max(0, Math.min(balance, received - booking));
    steps.push({ key: 'BALANCE', label: booking > 0 ? 'Balance' : 'Total', amount: balance, paid, remaining: balance - paid, status: statusOf(balance, paid), dueDate: null, note: paid >= balance ? null : 'Payment dates will be shared by your expert' });
  }
  const bookingStep = steps.find((s) => s.key === 'BOOKING');
  const next = bookingStep && bookingStep.remaining > 0 ? { amount: bookingStep.remaining, label: 'To confirm your booking', dueDate: null } : null;
  return { agreed, received, due, scheduled: false, steps, next };
}
