// The couple's budget (25 Nov 2026, Client OS → Budget). Pure: categories, input checks and the summary, shared by the service, the
// screens and the tests. What the couple booked with us comes from the agreement and its payments (read-only — the couple can never
// change our quotation or payments); their own vendors' prices and their own expenses are theirs.

export const COUPLE_BUDGET_CATEGORIES = [
  { id: 'VENUE', label: 'Venue' },
  { id: 'CATERING', label: 'Food & catering' },
  { id: 'DECOR', label: 'Decoration' },
  { id: 'PHOTO', label: 'Photo & video' },
  { id: 'MAKEUP', label: 'Makeup & mehndi' },
  { id: 'OUTFITS', label: 'Outfits' },
  { id: 'JEWELLERY', label: 'Jewellery' },
  { id: 'MUSIC', label: 'Music & baraat' },
  { id: 'INVITES', label: 'Invitations' },
  { id: 'GIFTS', label: 'Gifts & shagun' },
  { id: 'TRAVEL', label: 'Travel & stay' },
  { id: 'RITUALS', label: 'Pandit & rituals' },
  { id: 'OTHER', label: 'Other' },
] as const;
export type CoupleBudgetCategoryId = (typeof COUPLE_BUDGET_CATEGORIES)[number]['id'];
export const categoryLabel = (id: string) => COUPLE_BUDGET_CATEGORIES.find((c) => c.id === id)?.label ?? 'Other';
const isCategory = (v: unknown): v is CoupleBudgetCategoryId => COUPLE_BUDGET_CATEGORIES.some((c) => c.id === v);

export const MONEY_MAX = 100_00_00_000; // ₹100 crore — anything above is a typing slip
const rupees = (v: unknown): number | null | undefined => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s₹]/g, ''));
  return Number.isInteger(n) && n >= 0 && n <= MONEY_MAX ? n : undefined;
};

export function checkTotal(v: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  const n = rupees(v);
  return n === undefined ? { ok: false, error: 'The budget should be whole rupees' } : { ok: true, value: n };
}

export function checkPlanned(category: unknown, planned: unknown): { ok: true; value: { category: CoupleBudgetCategoryId; planned: number | null } } | { ok: false; error: string } {
  if (!isCategory(category)) return { ok: false, error: 'Choose a category' };
  const n = rupees(planned);
  if (n === undefined) return { ok: false, error: 'The amount should be whole rupees' };
  return { ok: true, value: { category, planned: n } };
}

export interface ExpenseInput {
  category: unknown;
  title: unknown;
  amount: unknown;
  paid?: unknown;
  spentOn?: unknown;
  notes?: unknown;
}

export function checkExpense(input: ExpenseInput): { ok: true; value: { category: CoupleBudgetCategoryId; title: string; amount: number; paid: number; spentOn: Date | null; notes: string | null } } | { ok: false; error: string } {
  if (!isCategory(input.category)) return { ok: false, error: 'Choose a category' };
  const title = typeof input.title === 'string' ? input.title.replace(/\s+/g, ' ').trim() : '';
  if (!title) return { ok: false, error: 'Say what it is for (for example “Bridal lehenga”)' };
  if (title.length > 100) return { ok: false, error: 'Keep it under 100 characters' };
  const amount = rupees(input.amount);
  if (amount === undefined || amount === null || amount === 0) return { ok: false, error: 'Add the amount in whole rupees' };
  const paid = rupees(input.paid) ?? 0;
  if (rupees(input.paid) === undefined) return { ok: false, error: 'Paid should be whole rupees' };
  if (paid > amount) return { ok: false, error: 'Paid cannot be more than the amount' };
  const raw = typeof input.spentOn === 'string' ? input.spentOn.trim() : '';
  const day = raw ? new Date(`${raw}T00:00:00Z`) : null;
  if (raw && !(/^\d{4}-\d{2}-\d{2}$/.test(raw) && day && !Number.isNaN(day.getTime()) && day.toISOString().startsWith(raw))) return { ok: false, error: 'Choose a valid date (or leave it empty)' };
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  if (notes.length > 300) return { ok: false, error: 'Keep the notes under 300 characters' };
  return { ok: true, value: { category: input.category, title, amount, paid, spentOn: day, notes: notes || null } };
}

// Which budget category a quotation line or one of the couple's own vendors belongs to, from its free-text category ("Decorators",
// "Venue" …) and then its description. Checked in order, so "Mandap decoration" is Decoration and "Banquet hall dinner" is Venue.
const CATEGORY_WORDS: [CoupleBudgetCategoryId, RegExp][] = [
  ['VENUE', /\b(venue|banquet|hall|lawn|ballroom|resort|farm ?house|marriage garden)/],
  ['CATERING', /\b(cater|food|menu|plates?\b|buffet|dinner|lunch|breakfast|snacks?\b|sweets|mithai|halwai)/],
  ['DECOR', /\b(decor|flower|floral|mandap|lighting|stage|tent)/],
  ['PHOTO', /\b(photo|video|film|cinemat|camera|drone|album)/],
  ['MAKEUP', /\b(make ?-?up|mehe?ndi|salon|hair|beautician)/],
  ['OUTFITS', /\b(outfit|lehenga|sherwani|saree|sari\b|tailor|boutique)/],
  ['JEWELLERY', /\b(jewel|gold\b)/],
  ['MUSIC', /\b(dj\b|band\b|dhol|music|sound|singer|baraat|ghodi|shehnai|orchestra)/],
  ['INVITES', /\b(invit|cards?\b)/],
  ['GIFTS', /\b(gift|shagun|hamper)/],
  ['TRAVEL', /\b(travel|transport|cars?\b|bus\b|cab|rooms?\b|stay|accommodation)/],
  ['RITUALS', /\b(pandit|puja|pooja|ritual|havan|samagri)/],
];
export function budgetCategoryFor(...texts: (string | null | undefined)[]): CoupleBudgetCategoryId {
  for (const text of texts) {
    const t = (text ?? '').toLowerCase();
    if (!t.trim()) continue;
    const hit = CATEGORY_WORDS.find(([, re]) => re.test(t));
    if (hit) return hit[0];
  }
  return 'OTHER';
}

// The agreed total split over categories in proportion to the quotation's lines (so discount and GST are shared out and the parts
// add up to exactly the agreed total). No lines (an invoice-only wedding) → not split.
export function bookedByCategory(agreed: number, lines: { category: string | null; description: string; amount: number }[]): Map<string, number> {
  const byCat = new Map<string, number>();
  const lineSum = lines.reduce((s, l) => s + Math.max(0, l.amount), 0);
  if (agreed <= 0 || lineSum <= 0) return byCat;
  for (const l of lines) {
    if (l.amount <= 0) continue;
    const id = budgetCategoryFor(l.category, l.description);
    byCat.set(id, (byCat.get(id) ?? 0) + l.amount);
  }
  let given = 0;
  let largest: string | null = null;
  for (const [id, amount] of byCat) {
    const share = Math.floor((agreed * amount) / lineSum);
    byCat.set(id, share);
    given += share;
    if (largest === null || share > (byCat.get(largest) ?? 0)) largest = id;
  }
  if (largest !== null) byCat.set(largest, (byCat.get(largest) ?? 0) + agreed - given); // the rounding paise go to the biggest part
  return byCat;
}

export interface BudgetFacts {
  total: number | null; // the couple's own total budget
  planned: { category: string; planned: number }[];
  booked: { agreed: number; paid: number }; // with Shaadi Shopping (or the venue): the agreement and payments received
  bookedLines?: { category: string | null; description: string; amount: number }[]; // the accepted quotation's lines
  ownVendors: { price: number | null; category?: string }[];
  expenses: { category: string; amount: number; paid: number }[];
}

export interface BudgetSummary {
  total: number | null;
  committed: number; // everything agreed or spent
  paid: number;
  left: number | null; // total − committed (negative = over budget)
  plannedTotal: number; // sum of the category plans
  parts: { booked: number; ownVendors: number; expenses: number };
  // spent = booked with us + own vendors + own expenses in that category; booked = the part of it that is booked with us
  categories: { category: string; label: string; planned: number | null; spent: number; booked: number }[];
}

export function budgetSummary(f: BudgetFacts): BudgetSummary {
  const ownVendors = f.ownVendors.reduce((s, v) => s + (v.price ?? 0), 0);
  const expenses = f.expenses.reduce((s, e) => s + e.amount, 0);
  const committed = f.booked.agreed + ownVendors + expenses;
  const paid = f.booked.paid + f.expenses.reduce((s, e) => s + e.paid, 0);
  const booked = bookedByCategory(f.booked.agreed, f.bookedLines ?? []);
  const vendorSpend = new Map<string, number>();
  for (const v of f.ownVendors) {
    if (!v.price) continue;
    const id = budgetCategoryFor(v.category);
    vendorSpend.set(id, (vendorSpend.get(id) ?? 0) + v.price);
  }
  const used = new Set([...f.planned.map((p) => p.category), ...f.expenses.map((e) => e.category), ...booked.keys(), ...vendorSpend.keys()]);
  const categories = COUPLE_BUDGET_CATEGORIES.filter((c) => used.has(c.id)).map((c) => ({
    category: c.id,
    label: c.label,
    planned: f.planned.find((p) => p.category === c.id)?.planned ?? null,
    spent: f.expenses.filter((e) => e.category === c.id).reduce((s, e) => s + e.amount, 0) + (booked.get(c.id) ?? 0) + (vendorSpend.get(c.id) ?? 0),
    booked: booked.get(c.id) ?? 0,
  }));
  return {
    total: f.total,
    committed,
    paid,
    left: f.total === null ? null : f.total - committed,
    plannedTotal: f.planned.reduce((s, p) => s + p.planned, 0),
    parts: { booked: f.booked.agreed, ownVendors, expenses },
    categories,
  };
}
