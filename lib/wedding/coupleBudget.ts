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
  if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { ok: false, error: 'Choose a valid date (or leave it empty)' };
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  if (notes.length > 300) return { ok: false, error: 'Keep the notes under 300 characters' };
  return { ok: true, value: { category: input.category, title, amount, paid, spentOn: raw ? new Date(`${raw}T00:00:00Z`) : null, notes: notes || null } };
}

export interface BudgetFacts {
  total: number | null; // the couple's own total budget
  planned: { category: string; planned: number }[];
  booked: { agreed: number; paid: number }; // with Shaadi Shopping (or the venue): the agreement and payments received
  ownVendors: { price: number | null }[];
  expenses: { category: string; amount: number; paid: number }[];
}

export interface BudgetSummary {
  total: number | null;
  committed: number; // everything agreed or spent
  paid: number;
  left: number | null; // total − committed (negative = over budget)
  plannedTotal: number; // sum of the category plans
  parts: { booked: number; ownVendors: number; expenses: number };
  categories: { category: string; label: string; planned: number | null; spent: number }[];
}

export function budgetSummary(f: BudgetFacts): BudgetSummary {
  const ownVendors = f.ownVendors.reduce((s, v) => s + (v.price ?? 0), 0);
  const expenses = f.expenses.reduce((s, e) => s + e.amount, 0);
  const committed = f.booked.agreed + ownVendors + expenses;
  const paid = f.booked.paid + f.expenses.reduce((s, e) => s + e.paid, 0);
  const used = new Set([...f.planned.map((p) => p.category), ...f.expenses.map((e) => e.category)]);
  const categories = COUPLE_BUDGET_CATEGORIES.filter((c) => used.has(c.id)).map((c) => ({
    category: c.id,
    label: c.label,
    planned: f.planned.find((p) => p.category === c.id)?.planned ?? null,
    spent: f.expenses.filter((e) => e.category === c.id).reduce((s, e) => s + e.amount, 0),
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
