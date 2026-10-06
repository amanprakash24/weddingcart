// GST worked out line by line (founder decision, 6 Oct 2026): every line of a quotation carries its own GST rate, typed by the
// vendor — there is no fixed or default rate anywhere. Pure and client-safe: the form shows exactly what the server will store.
//
// The rule, in the order a document shows it:
//   amount   = how many × price each
//   discount = the quotation's one discount, spread over the lines in proportion to their amounts (so it reduces what is taxed)
//   taxable  = amount − that line's share of the discount
//   GST      = taxable × the line's rate, rounded to the nearest rupee            (GST is ADDED to the price, never inside it)
//   total    = Σ taxable + Σ GST
//
// A rate is stored in hundredths of a percent ("basis points": 18% = 1800, 0.25% = 25), so no fraction is ever stored as a float.

export const GST_RATE_MAX_BP = 4000; // 40% — above any GST slab; a typing slip like "180" is caught

// What the vendor typed in a "GST %" box → the stored rate. '' = no GST on this line (null). undefined = not a valid rate.
export function parseGstPercent(raw: unknown): number | null | undefined {
  const text = (typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw : '').replace(/[%\s]/g, '');
  if (!text) return null;
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(text)) return undefined;
  const bp = Math.round(Number(text) * 100);
  return bp <= GST_RATE_MAX_BP ? bp : undefined;
}

// The stored rate as people read it: 1800 → "18", 250 → "2.5", 25 → "0.25".
export const gstPercentText = (bp: number) => String(bp / 100);

export interface GstLineInput {
  quantity: number;
  unitPrice: number;
  gstRateBp?: number | null;
}

export interface GstLine {
  amount: number; // how many × price each
  discount: number; // this line's share of the quotation's discount
  taxable: number; // amount − discount
  gstRateBp: number | null;
  gst: number; // whole rupees
}

export interface GstTotals {
  lines: GstLine[];
  subtotal: number; // Σ amount
  discount: number;
  taxable: number; // subtotal − discount
  gst: number; // Σ line GST
  total: number; // taxable + gst
  hasGst: boolean; // at least one line carries a rate above 0
}

// Shares of `discount` across the lines, in proportion to their amounts, in whole rupees that add up to exactly `discount`
// (largest remainders get the leftover rupees; ties go to the earlier line).
function spreadDiscount(amounts: number[], discount: number): number[] {
  const subtotal = amounts.reduce((a, b) => a + b, 0);
  if (discount <= 0 || subtotal <= 0) return amounts.map(() => 0);
  const exact = amounts.map((a) => (a * discount) / subtotal);
  const shares = exact.map(Math.floor);
  let left = discount - shares.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    shares[i] += 1;
    left -= 1;
  }
  return shares;
}

export function gstTotals(items: GstLineInput[], discount = 0): GstTotals {
  const amounts = items.map((l) => l.quantity * l.unitPrice);
  const subtotal = amounts.reduce((a, b) => a + b, 0);
  const shares = spreadDiscount(amounts, Math.min(Math.max(discount, 0), subtotal));
  const lines = items.map((l, i): GstLine => {
    const taxable = amounts[i] - shares[i];
    const gstRateBp = l.gstRateBp ?? null;
    return { amount: amounts[i], discount: shares[i], taxable, gstRateBp, gst: gstRateBp ? Math.round((taxable * gstRateBp) / 10000) : 0 };
  });
  const appliedDiscount = shares.reduce((a, b) => a + b, 0);
  const gst = lines.reduce((a, l) => a + l.gst, 0);
  return { lines, subtotal, discount: appliedDiscount, taxable: subtotal - appliedDiscount, gst, total: subtotal - appliedDiscount + gst, hasGst: lines.some((l) => l.gst > 0 || (l.gstRateBp ?? 0) > 0) };
}
