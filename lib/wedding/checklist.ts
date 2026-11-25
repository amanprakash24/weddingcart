// The couple's checklist (25 Nov 2026, Client OS → Checklist). Pure: the ready-made list and its dates, shared by the service, the
// screens and the tests. Each item is dated back from the wedding day; one that only matters for a function (Mehndi artist, Haldi
// items …) appears only when the wedding has that function. An item whose date has already passed is shown undated under
// "Earlier steps — tick what is done", so a wedding a week away does not open with thirty overdue items.

export interface ChecklistTemplateItem {
  key: string;
  title: string;
  daysBefore: number;
  needs?: string[]; // function types; the item appears only if the wedding has one of them
}

export const CHECKLIST_TEMPLATE: ChecklistTemplateItem[] = [
  { key: 'fix-date', title: 'Fix the wedding date with family and pandit ji', daysBefore: 180 },
  { key: 'set-budget', title: 'Set your total budget (Budget section)', daysBefore: 170 },
  { key: 'book-venue', title: 'Book the venue', daysBefore: 160 },
  { key: 'book-caterer', title: 'Choose the caterer and do a menu tasting', daysBefore: 150 },
  { key: 'book-photo', title: 'Book the photographer and videographer', daysBefore: 140 },
  { key: 'book-decor', title: 'Book the decorator and share your theme', daysBefore: 130 },
  { key: 'guest-list', title: 'Make the guest list (Guests section)', daysBefore: 120 },
  { key: 'book-makeup', title: 'Book the bridal makeup artist', daysBefore: 110 },
  { key: 'book-mehndi', title: 'Book the mehndi artist', daysBefore: 100, needs: ['MEHNDI'] },
  { key: 'book-music', title: 'Book DJ, band or dhol', daysBefore: 95, needs: ['SANGEET', 'WEDDING', 'RECEPTION'] },
  { key: 'outfits', title: 'Order the wedding outfits — lehenga, sherwani, family outfits', daysBefore: 90 },
  { key: 'jewellery', title: 'Choose the jewellery', daysBefore: 80 },
  { key: 'guest-rooms', title: 'Book rooms for guests coming from outside', daysBefore: 75 },
  { key: 'invites-design', title: 'Design the invitation cards and e-invites', daysBefore: 60 },
  { key: 'pandit', title: 'Book pandit ji and list what each ritual needs', daysBefore: 50 },
  { key: 'tilak', title: 'Plan the Tilak — items, gifts and who comes', daysBefore: 45, needs: ['TILAK'] },
  { key: 'invites-send', title: 'Send the invitations', daysBefore: 45 },
  { key: 'baraat', title: 'Plan the baraat — ghodi or car, band, route', daysBefore: 40, needs: ['WEDDING'] },
  { key: 'makeup-trial', title: 'Makeup and hair trial', daysBefore: 30 },
  { key: 'transport', title: 'Arrange cars for family and guests', daysBefore: 30 },
  { key: 'fittings', title: 'Final outfit fittings', daysBefore: 21 },
  { key: 'gifts', title: 'Pack shagun, gifts and return gifts', daysBefore: 21 },
  { key: 'guest-count', title: 'Give the final guest count to the caterer', daysBefore: 14 },
  { key: 'haldi-items', title: 'Get the Haldi items ready — haldi, flowers, yellow outfits', daysBefore: 14, needs: ['HALDI'] },
  { key: 'reception-look', title: 'Plan the reception look and entry', daysBefore: 14, needs: ['RECEPTION'] },
  { key: 'vendor-times', title: 'Confirm every vendor’s timing and phone number', daysBefore: 10 },
  { key: 'rsvp-chase', title: 'Call guests who have not answered the invitation', daysBefore: 7 },
  { key: 'day-payments', title: 'Keep the payments due on the day ready', daysBefore: 7 },
  { key: 'pack-bags', title: 'Pack a bag for each function', daysBefore: 3 },
  { key: 'family-roles', title: 'Give each family coordinator the day’s schedule', daysBefore: 2 },
  { key: 'rest', title: 'Rest, drink water, enjoy — your team has the rest', daysBefore: 1 },
];

const DAY = 24 * 60 * 60 * 1000;
const utcDay = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const ymdOf = (d: Date) => d.toISOString().slice(0, 10);

export interface SeedItem {
  templateKey: string;
  title: string;
  dueDate: Date | null;
  sortOrder: number;
}

// The ready-made items for this wedding: dated back from the wedding day (YYYY-MM-DD); one already past → undated ("earlier steps").
export function checklistSeed(weddingDay: string, functionTypes: readonly string[], today: string): SeedItem[] {
  const has = new Set(functionTypes);
  return CHECKLIST_TEMPLATE.filter((t) => !t.needs || t.needs.some((n) => has.has(n))).map((t, i) => {
    const due = new Date(utcDay(weddingDay).getTime() - t.daysBefore * DAY);
    return { templateKey: t.key, title: t.title, dueDate: ymdOf(due) < today ? null : due, sortOrder: i };
  });
}

// When the wedding day moves: the new date for a ready-made item, or undefined when it stays as it is. The same rule as the seed
// (a date already past → undated "earlier step"), but an item that is simply overdue on an unchanged wedding day stays overdue.
// Not for items the couple dated themselves (customDate) or ticked — the caller leaves those alone.
export function redatedDue(templateKey: string, weddingDay: string, today: string, stored: string | null): Date | null | undefined {
  const t = CHECKLIST_TEMPLATE.find((x) => x.key === templateKey);
  if (!t) return undefined;
  const expected = new Date(utcDay(weddingDay).getTime() - t.daysBefore * DAY);
  const expectedYmd = ymdOf(expected);
  if (stored === expectedYmd) return undefined; // the wedding day has not moved
  if (stored === null && expectedYmd < today) return undefined; // still an earlier step
  const next = expectedYmd < today ? null : expected;
  return (next ? expectedYmd : null) === stored ? undefined : next;
}

export const TITLE_MAX = 140;
export const NOTES_MAX = 500;

export interface ChecklistItemInput {
  title: unknown;
  notes?: unknown;
  dueDate?: unknown; // YYYY-MM-DD or ''
  weddingEventId?: unknown;
}

export function checkChecklistItem(input: ChecklistItemInput): { ok: true; value: { title: string; notes: string | null; dueDate: Date | null; weddingEventId: string | null } } | { ok: false; error: string } {
  const title = typeof input.title === 'string' ? input.title.replace(/\s+/g, ' ').trim() : '';
  if (!title) return { ok: false, error: 'Write what needs doing' };
  if (title.length > TITLE_MAX) return { ok: false, error: `Keep it under ${TITLE_MAX} characters` };
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  if (notes.length > NOTES_MAX) return { ok: false, error: `Keep the notes under ${NOTES_MAX} characters` };
  const raw = typeof input.dueDate === 'string' ? input.dueDate.trim() : '';
  if (raw && !(/^\d{4}-\d{2}-\d{2}$/.test(raw) && ymdOf(utcDay(raw)) === raw)) return { ok: false, error: 'Choose a valid date (or leave it empty)' };
  const fn = typeof input.weddingEventId === 'string' && input.weddingEventId.trim() ? input.weddingEventId.trim() : null;
  return { ok: true, value: { title, notes: notes || null, dueDate: raw ? utcDay(raw) : null, weddingEventId: fn } };
}

export type ChecklistGroup = 'OVERDUE' | 'THIS_WEEK' | 'LATER' | 'EARLIER' | 'DONE';

// Where an item sits on the screen.
export function checklistGroup(item: { done: boolean; dueDate: string | null }, today: string): ChecklistGroup {
  if (item.done) return 'DONE';
  if (!item.dueDate) return 'EARLIER';
  if (item.dueDate < today) return 'OVERDUE';
  const week = ymdOf(new Date(utcDay(today).getTime() + 7 * DAY));
  return item.dueDate <= week ? 'THIS_WEEK' : 'LATER';
}
