// The commercial rules of a booking, in ONE place (founder decision, 22 Sep 2026):
//
//   • a booking is confirmed only when at least 25% of the accepted quotation total has been received;
//   • a smaller payment holds the date for 7 days (Date Held / Confirmation Pending);
//   • the 25% is rounded UP to the next rupee.
//
// Nothing else in the code base may hard-code 25 or 7. A future Settings screen changes these values for NEW agreements only: each
// agreement stores the values it was made with (lib/commercial/agreement.ts), so an accepted deal is never re-priced by a later rule.
//
// Pure and free of server imports.
import { daysFromToday } from '@/lib/wedding/stage';

export interface CommercialRules {
  confirmationPercent: number; // % of the accepted quotation total that must be received to confirm the booking
  holdWindowDays: number; // days a part payment holds the date
  rounding: 'CEIL_RUPEE';
}

export const COMMERCIAL_RULES: CommercialRules = { confirmationPercent: 25, holdWindowDays: 7, rounding: 'CEIL_RUPEE' };

const MS_PER_DAY = 86_400_000;
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// Exactly `percent`% of the total, rounded up to the next whole rupee. Integer arithmetic only, so no floating-point surprises
// (₹2,00,000 → ₹50,000; ₹1,00,001 → ₹25,001).
export function requiredConfirmation(total: number, rules: Pick<CommercialRules, 'confirmationPercent'> = COMMERCIAL_RULES): number {
  if (!Number.isInteger(total) || total <= 0) return 0;
  return Math.floor((total * rules.confirmationPercent + 99) / 100);
}

export type ConfirmationState = 'NOT_STARTED' | 'DATE_HELD' | 'CONFIRMED';

export interface ConfirmationStatus {
  state: ConfirmationState;
  required: number;
  received: number;
  remaining: number; // still to receive to reach the required amount
  holdStartedAt: Date | null;
  holdExpiresAt: Date | null;
  daysLeft: number | null; // whole India-calendar days until the hold ends (0 = today, negative = late); only while the date is held
  overdue: boolean; // date held, and the hold window has passed without reaching the required amount — a person must decide
  message: string; // one honest sentence
}

export const holdExpiry = (startedAt: Date, holdWindowDays: number): Date => new Date(startedAt.getTime() + holdWindowDays * MS_PER_DAY);

// Where a booking stands, derived from the agreement and what was received. Never stored as a number (the amounts are read from the
// payments), so there is only one source of truth.
export function confirmationStatus(input: {
  required: number;
  received: number;
  holdStartedAt?: Date | null;
  holdWindowDays?: number;
  now?: Date;
}): ConfirmationStatus {
  const { required, received } = input;
  const now = input.now ?? new Date();
  const remaining = Math.max(0, required - received);
  const holdStartedAt = input.holdStartedAt ?? null;
  const holdExpiresAt = holdStartedAt ? holdExpiry(holdStartedAt, input.holdWindowDays ?? COMMERCIAL_RULES.holdWindowDays) : null;
  const base = { required, received, remaining, holdStartedAt, holdExpiresAt };

  if (required > 0 && received >= required) {
    return { ...base, state: 'CONFIRMED', daysLeft: null, overdue: false, message: `${inr(received)} received — the ${inr(required)} needed to confirm the booking is in.` };
  }
  if (received <= 0) {
    return { ...base, state: 'NOT_STARTED', daysLeft: null, overdue: false, message: `${inr(required)} is needed to confirm this booking. Nothing has been received yet.` };
  }
  const daysLeft = holdExpiresAt ? daysFromToday(holdExpiresAt, now) : null;
  const overdue = daysLeft !== null && daysLeft < 0;
  const window = input.holdWindowDays ?? COMMERCIAL_RULES.holdWindowDays;
  const when = daysLeft === null ? '' : overdue ? ` The ${window}-day hold ended ${-daysLeft} ${-daysLeft === 1 ? 'day' : 'days'} ago — decide what to do.` : daysLeft === 0 ? ' The hold ends today.' : ` ${daysLeft} of ${window} days left to hold the date.`;
  return { ...base, state: 'DATE_HELD', daysLeft, overdue, message: `${inr(remaining)} more required to confirm this booking.${when}` };
}

// What the server says when someone tries to confirm a booking that has not received enough.
export function confirmationRefusal(status: Pick<ConfirmationStatus, 'remaining'>): string {
  return `${inr(status.remaining)} more required to confirm this booking.`;
}
