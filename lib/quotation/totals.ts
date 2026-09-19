// The one place a quotation's money is calculated (docs/wedding-os/08-quotation.md §5).
//
// All amounts are integer rupees, like Invoice. The API accepts only *inputs*
// (line items, discount, tax amount, advance) — never totals — and calls this on
// every write, so a client can't send a wrong total. The database backs it up with
// a CHECK constraint (quotations_money_chk) that enforces the same identity.
//
// Tax is a typed amount, never a percentage the product calculates: GST treatment
// is a compliance question for the CA (06-finance.md §5), so nothing here invents one.
import { ValidationError } from '@/lib/errors';

// Money columns are Postgres INTEGER (32-bit, max 2,147,483,647). Stay clear of it.
export const MAX_TOTAL_RUPEES = 2_000_000_000;
export const MAX_UNIT_PRICE_RUPEES = 100_000_000; // ₹10 crore per unit
export const MAX_QUANTITY = 100_000;
export const MAX_LINE_ITEMS = 50;

export interface QuotationLineInput {
  unitPrice: number;
  quantity: number;
}

export interface QuotationTotalsInput {
  items: QuotationLineInput[];
  discount?: number;
  gstAmount?: number;
  advanceAmount?: number;
}

export interface QuotationTotals {
  subtotal: number;
  discount: number;
  gstAmount: number;
  total: number;
  advanceAmount: number;
  balance: number; // derived, never stored
}

function assertWholeRupees(value: number, label: string, max: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${label} must be a whole number of rupees, zero or more`);
  }
  if (value > max) {
    throw new ValidationError(`${label} is too large`);
  }
}

export function lineTotal(line: QuotationLineInput): number {
  return line.unitPrice * line.quantity;
}

export function calculateQuotationTotals(input: QuotationTotalsInput): QuotationTotals {
  if (input.items.length > MAX_LINE_ITEMS) {
    throw new ValidationError(`A quotation can have at most ${MAX_LINE_ITEMS} line items`);
  }

  let subtotal = 0;
  input.items.forEach((line, index) => {
    const n = index + 1;
    assertWholeRupees(line.unitPrice, `Line ${n} price`, MAX_UNIT_PRICE_RUPEES);
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) {
      throw new ValidationError(`Line ${n} quantity must be a whole number from 1 to ${MAX_QUANTITY}`);
    }
    subtotal += lineTotal(line);
  });
  if (subtotal > MAX_TOTAL_RUPEES) {
    throw new ValidationError('The quotation total is too large');
  }

  const discount = input.discount ?? 0;
  const gstAmount = input.gstAmount ?? 0;
  const advanceAmount = input.advanceAmount ?? 0;
  assertWholeRupees(discount, 'Discount', MAX_TOTAL_RUPEES);
  assertWholeRupees(gstAmount, 'Tax amount', MAX_TOTAL_RUPEES);
  assertWholeRupees(advanceAmount, 'Advance', MAX_TOTAL_RUPEES);

  if (discount > subtotal) {
    throw new ValidationError('Discount cannot be more than the subtotal');
  }
  const total = subtotal - discount + gstAmount;
  if (total > MAX_TOTAL_RUPEES) {
    throw new ValidationError('The quotation total is too large');
  }
  if (advanceAmount > total) {
    throw new ValidationError('Advance cannot be more than the total');
  }

  return { subtotal, discount, gstAmount, total, advanceAmount, balance: total - advanceAmount };
}
