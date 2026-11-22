// Each quoted line's share of what was actually agreed (22 Nov 2026).
//
// A quotation can list items at full price and take a discount off the whole (QTN-202611-0005: lines ₹5,17,500, discount ₹4,32,000,
// agreed ₹85,500). Vendor budgets used to be the full line prices — "₹3,20,000 to allocate" on an ₹85,500 deal. Each line now gets its
// share of the agreed amount before tax, in proportion to its price, in whole rupees, and the shares always add up to it exactly
// (largest remainder: the rupees lost to rounding go to the lines with the biggest fractions, earliest first on a tie).

export function netShares(lineAmounts: number[], netTotal: number): number[] {
  const total = lineAmounts.reduce((s, a) => s + Math.max(0, a), 0);
  const target = Math.max(0, Math.round(netTotal));
  if (total === 0 || target === 0) return lineAmounts.map(() => 0);
  if (target >= total) return lineAmounts.map((a) => Math.max(0, a)); // no discount (or more than the lines): the lines as they are
  const exact = lineAmounts.map((a) => (Math.max(0, a) * target) / total);
  const shares = exact.map(Math.floor);
  let left = target - shares.reduce((s, x) => s + x, 0);
  const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    shares[i] += 1;
    left -= 1;
  }
  return shares;
}
