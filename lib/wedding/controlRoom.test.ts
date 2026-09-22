/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import type { WeddingWorkspace, WorkspaceInvoice, WorkspaceWeddingEvent } from '@/components/wedding/workspace/types';
import { buildControlRoom, buildJourney, buildMoney, coupleTitle, dateWords, whenWords } from './controlRoom';
import { unassignedServiceFromTask } from '@/lib/booking/unassigned';

// "Today" is Monday 21 Sep 2026 in India.
const NOW = new Date('2026-09-21T04:30:00.000Z');
const day = (n: number) => new Date(Date.UTC(2026, 8, 21 + n)).toISOString();

const vb = (id: string, name: string, category: string, status: WorkspaceWeddingEvent['vendorBookings'][number]['status'], price = 10000) => ({
  id, vendorId: `v-${id}`, vendorName: name, vendorCategory: category, status, agreedPrice: price, declineReason: null, respondedAt: null, onTimeService: null, payout: null,
});
const fn = (id: string, type: string, label: string | null, date: string, vendorBookings: WorkspaceWeddingEvent['vendorBookings'] = [], extra: Partial<WorkspaceWeddingEvent> = {}): WorkspaceWeddingEvent => ({
  id, type, label, date, startTime: null, venueName: null, venueAddress: null, city: 'Patna', budget: null, tasks: [], vendorBookings, ...extra,
});
const invoice = (over: Partial<WorkspaceInvoice> & Pick<WorkspaceInvoice, 'id' | 'kind' | 'status' | 'total' | 'amountPaid'>): WorkspaceInvoice => ({
  invoiceNumber: `INV-${over.id}`, clientName: 'Rahul & Priya Sharma', subtotal: over.total, discount: 0, gstEnabled: false, gstAmount: 0, outstanding: over.total - over.amountPaid,
  createdAt: day(-10), quotationId: 'q1', bookingId: 'b1', issuedAt: over.status === 'DRAFT' ? null : day(-9), items: [], payments: [], paymentLinks: [], ...over,
});
const agreement = { quotationId: 'q1', quotationNumber: 'QTN-202609-0003', revision: 3, bookingId: 'b1', acceptedAt: day(-12), subtotal: 115500, discount: 5500, gstEnabled: false, gstAmount: 0, total: 110000, advance: 50000, balance: 60000, terms: 'T&C', lines: [], hasBalanceInvoice: false };

function ws(over: Partial<WeddingWorkspace> = {}): WeddingWorkspace {
  return {
    wedding: {
      id: 'w1', weddingNumber: 'WED-2026-0002', status: 'PLANNING', source: 'BOOKING', primaryDate: day(60), city: 'Patna', guestCount: 400, weddingType: 'wedding',
      totalBudget: null, coordinatorName: 'Asha', customerName: null, createdAt: day(-10), completedAt: null,
    },
    sourceLead: { sourceType: 'CONSULTATION', id: 'c1' },
    health: 'HEALTHY',
    couple: { brideName: 'Priya', bridePhone: null, groomName: 'Rahul', groomPhone: null, preferredLanguage: null, preferences: null },
    events: [fn('e1', 'WEDDING', null, day(60), [vb('1', 'Rajdhani Palace', 'Venue', 'CONFIRMED', 60000)], { venueName: 'Rajdhani Palace' })],
    timeline: [], activity: [], tasks: [], documents: [],
    finance: {
      budget: { planned: null, committed: 0, variance: null },
      invoices: [invoice({ id: 'a', kind: 'ADVANCE', status: 'SENT', total: 50000, amountPaid: 0 })],
      totals: { invoicedTotal: 50000, collected: 0, outstanding: 50000 },
      agreement,
    },
    guests: [], insights: [],
    ...over,
  };
}

describe('identity', () => {
  test('the title is the couple, never the WED number', () => {
    const view = buildControlRoom(ws(), NOW);
    expect(view.title).toBe('Priya & Rahul');
    expect(view.title).not.toContain('WED-');
    expect(view.secondary.weddingNumber).toBe('WED-2026-0002'); // still available, just not the heading
  });

  test('falls back to the customer, then to the name on the invoice, then to the date — never the WED number', () => {
    expect(coupleTitle(ws({ couple: null, wedding: { ...ws().wedding, customerName: 'Anita Verma' } }))).toBe('Anita Verma');
    expect(coupleTitle(ws({ couple: null }))).toBe('Rahul & Priya Sharma');
    const bare = ws({ couple: null });
    bare.finance = { ...bare.finance, invoices: [] };
    expect(coupleTitle(bare)).toBe(`Wedding · ${dateWords(bare.wedding.primaryDate)}`);
  });

  test('one bride name only still reads properly', () => {
    expect(coupleTitle(ws({ couple: { brideName: 'Priya', bridePhone: null, groomName: null, groomPhone: null, preferredLanguage: null, preferences: null } }))).toBe('Priya');
  });

  test('facts are the date, the venue and city, and the guests — from the data', () => {
    const view = buildControlRoom(ws(), NOW);
    expect(view.facts).toEqual([dateWords(day(60)) as string, 'Rajdhani Palace, Patna', '400 guests']);
    expect(view.when).toBe('in 60 days');
  });

  test('no guest count and no venue: only what is known is shown', () => {
    const view = buildControlRoom(ws({ wedding: { ...ws().wedding, guestCount: null }, events: [fn('e1', 'WEDDING', null, day(60))] }), NOW);
    expect(view.facts).toEqual([dateWords(day(60)) as string, 'Patna']);
  });

  test('booking is confirmed and the stage is a plain word — never the raw status, "Active" or a health chip', () => {
    const view = buildControlRoom(ws({ wedding: { ...ws().wedding, status: 'ACTIVE' } }), NOW);
    expect(view.bookingLabel).toBe('Booking confirmed');
    expect(view.stageLabel).toBe('Planning');
    const words = JSON.stringify({ a: view.bookingLabel, b: view.stageLabel, c: view.journey.map((j) => j.label), d: view.pulse.map((p) => [p.label, p.value]) });
    for (const banned of ['Active', 'ACTIVE', 'PLANNING', 'Final Booking', 'Healthy', 'From CRM']) expect(words).not.toContain(banned);
  });
});

describe('stage and journey (from the merged stage engine)', () => {
  test('the journey follows the stage; vendors never move it', () => {
    const steps = (status: 'PLANNING' | 'ACTIVE', dayN: number) => buildControlRoom(ws({ wedding: { ...ws().wedding, status, primaryDate: day(dayN) }, events: [fn('e1', 'WEDDING', null, day(dayN))] }), NOW);
    expect(steps('PLANNING', 60).journey.map((j) => `${j.key}:${j.state}`)).toEqual(['BOOKING:done', 'PLANNING:current', 'FINAL_WEEK:todo', 'WEDDING_DAY:todo', 'COMPLETED:todo']);
    expect(steps('ACTIVE', 60).journey).toEqual(steps('PLANNING', 60).journey); // a confirmed vendor (ACTIVE) changes nothing
    expect(steps('PLANNING', 5).stageLabel).toBe('Final week');
    expect(steps('PLANNING', 0).stageLabel).toBe('Wedding day');
  });

  test('completed: every step is done', () => {
    expect(buildJourney('COMPLETED').every((j) => j.state === 'done')).toBe(true);
  });

  test('postponed and cancelled show a banner, and no step is "current"', () => {
    const p = buildControlRoom(ws({ wedding: { ...ws().wedding, status: 'POSTPONED' } }), NOW);
    expect(p.banner).toBe('This wedding is postponed.');
    expect(p.journey.some((j) => j.state === 'current')).toBe(false);
    expect(p.canResume).toBe(true);
    expect(buildControlRoom(ws({ wedding: { ...ws().wedding, status: 'CANCELLED' } }), NOW).banner).toBe('This wedding was cancelled.');
  });

  test('postpone/cancel only before the wedding day; completing only once the last day has come', () => {
    expect(buildControlRoom(ws(), NOW)).toMatchObject({ canPostponeOrCancel: true, canComplete: false });
    const today = buildControlRoom(ws({ wedding: { ...ws().wedding, primaryDate: day(0) }, events: [fn('e1', 'WEDDING', null, day(0))] }), NOW);
    expect(today).toMatchObject({ canPostponeOrCancel: false, canComplete: true });
  });
});

describe('next action reuses the merged engine — and the locked money wording', () => {
  test('a draft advance invoice → "Send advance invoice"', () => {
    const w = ws();
    w.finance.invoices = [invoice({ id: 'a', kind: 'ADVANCE', status: 'DRAFT', total: 50000, amountPaid: 0 })];
    expect(buildControlRoom(w, NOW).next.title).toBe('Send advance invoice');
  });

  test('an issued advance invoice → "Advance payment of ₹50,000 pending" (never "Send…")', () => {
    expect(buildControlRoom(ws(), NOW).next.title).toBe('Advance payment of ₹50,000 pending');
  });

  test('a part-paid advance → "Advance payment of ₹30,000 pending"', () => {
    const w = ws();
    w.finance.invoices = [invoice({ id: 'a', kind: 'ADVANCE', status: 'PARTIALLY_PAID', total: 50000, amountPaid: 20000 })];
    w.finance.totals = { invoicedTotal: 50000, collected: 20000, outstanding: 30000 };
    expect(buildControlRoom(w, NOW).next.title).toBe('Advance payment of ₹30,000 pending');
  });

  test('a pending vendor outranks money; an overdue high-priority task outranks both', () => {
    const w = ws({ events: [fn('e1', 'WEDDING', null, day(60), [vb('1', 'Rajdhani Palace', 'Venue', 'PENDING_VENDOR_CONFIRMATION')])] });
    expect(buildControlRoom(w, NOW).next.title).toBe('Get Rajdhani Palace to confirm');
    w.tasks = [{ id: 't1', title: 'Pay the tent advance', description: null, status: 'PENDING', priority: 'URGENT', dueAt: day(-2), completedAt: null, assignedToName: null, createdAt: day(-9) }];
    expect(buildControlRoom(w, NOW).next.title).toBe('Overdue: Pay the tent advance');
  });

  test('missing coordinator, then missing information, then a task, then on track', () => {
    const settled = () => { const w = ws(); w.finance.invoices = [invoice({ id: 'a', kind: 'ADVANCE', status: 'PAID', total: 50000, amountPaid: 50000 })]; w.finance.totals = { invoicedTotal: 50000, collected: 50000, outstanding: 0 }; return w; };
    const noCoordinator = settled(); noCoordinator.wedding.coordinatorName = null;
    expect(buildControlRoom(noCoordinator, NOW).next.kind).toBe('MISSING_COORDINATOR');
    expect(buildControlRoom(settled(), NOW).next.kind).toBe('ON_TRACK');
  });

  test('after the last day: unpaid money first, otherwise "Mark wedding as completed"', () => {
    const over = ws({ wedding: { ...ws().wedding, primaryDate: day(-2) }, events: [fn('e1', 'WEDDING', null, day(-2))] });
    expect(buildControlRoom(over, NOW).next.kind).toBe('INVOICE_PAYMENT');
    over.finance.invoices = [invoice({ id: 'a', kind: 'ADVANCE', status: 'PAID', total: 50000, amountPaid: 50000 })];
    expect(buildControlRoom(over, NOW).next.title).toBe('Mark wedding as completed');
  });

  test('an ordinary open task is the next step, not an "issue" — and never repeats an overdue task already listed', () => {
    const t = (id: string, title: string, due: string | null, priority: 'LOW' | 'URGENT') => ({ id, title, description: null, status: 'PENDING' as const, priority, dueAt: due, completedAt: null, assignedToName: null, createdAt: day(-9) });
    const settled = ws();
    settled.finance.invoices = [invoice({ id: 'a', kind: 'ADVANCE', status: 'PAID', total: 50000, amountPaid: 50000 })];
    settled.tasks = [t('1', 'Send save-the-date cards', day(3), 'LOW')];
    const calm = buildControlRoom(settled, NOW);
    expect(calm.next.kind).toBe('OPEN_TASK');
    expect(calm.attention).toEqual([]);
    settled.tasks = [t('2', 'Pay the tent advance', day(-2), 'URGENT'), t('3', 'Send save-the-date cards', day(3), 'LOW')];
    expect(buildControlRoom(settled, NOW).attention.map((a) => a.kind)).toEqual(['CRITICAL_OVERDUE']);
  });

  test('the venue vendor booked for the wedding is the place shown, ahead of a function\'s free-text venue', () => {
    const w = ws({ events: [fn('e1', 'WEDDING', null, day(60), [vb('1', '7 Vachan', 'Venues', 'CONFIRMED')], { venueName: 'Some other text' })] });
    expect(buildControlRoom(w, NOW).facts[1]).toBe('7 Vachan, Patna');
  });

  test('"needs attention" is the same engine\'s list — real issues only, empty when on track', () => {
    const w = ws({ events: [fn('e1', 'WEDDING', null, day(60), [vb('1', 'Rajdhani Palace', 'Venue', 'PENDING_VENDOR_CONFIRMATION')])] });
    w.wedding.coordinatorName = null;
    const view = buildControlRoom(w, NOW);
    expect(view.attention.map((a) => a.kind)).toEqual(['PENDING_VENDOR_CONFIRMATION', 'INVOICE_PAYMENT', 'MISSING_COORDINATOR']);
    const settled = ws(); settled.finance.invoices = [invoice({ id: 'a', kind: 'ADVANCE', status: 'PAID', total: 50000, amountPaid: 50000 })];
    expect(buildControlRoom(settled, NOW).attention).toEqual([]);
  });
});

describe('money — from the accepted agreement and its invoices, never hard-coded', () => {
  test('nothing paid yet: total, advance, received, balance and a plain sentence', () => {
    const m = buildMoney(ws());
    expect(m).toMatchObject({ mode: 'agreement', total: 110000, advance: 50000, received: 0, balance: 60000, advanceStatus: 'unpaid', advancePending: 50000, quotationNumber: 'QTN-202609-0003' });
    expect(m.headline).toBe('Advance of ₹50,000 is pending');
  });

  test('a part-paid advance is called out as partial, not as "received"', () => {
    const w = ws();
    w.finance.invoices = [invoice({ id: 'a', kind: 'ADVANCE', status: 'PARTIALLY_PAID', total: 50000, amountPaid: 20000 })];
    w.finance.totals = { invoicedTotal: 50000, collected: 20000, outstanding: 30000 };
    const m = buildMoney(w);
    expect(m).toMatchObject({ received: 20000, advanceStatus: 'partial', advanceReceived: 20000, advancePending: 30000, balance: 60000, stillToCome: 90000 });
    expect(m.headline).toBe('₹30,000 of the ₹50,000 advance is still pending');
  });

  test('advance paid: the balance invoice, once it exists, is what "balance" means', () => {
    const w = ws();
    w.finance.invoices = [
      invoice({ id: 'a', kind: 'ADVANCE', status: 'PAID', total: 50000, amountPaid: 50000 }),
      invoice({ id: 'b', kind: 'BALANCE', status: 'PARTIALLY_PAID', total: 60000, amountPaid: 25000 }),
    ];
    w.finance.totals = { invoicedTotal: 110000, collected: 75000, outstanding: 35000 };
    expect(buildMoney(w)).toMatchObject({ advanceStatus: 'paid', received: 75000, balance: 35000, stillToCome: 35000 });
  });

  test('an advance invoice that is still a draft, and an advance nobody has invoiced, read differently', () => {
    const draft = ws(); draft.finance.invoices = [invoice({ id: 'a', kind: 'ADVANCE', status: 'DRAFT', total: 50000, amountPaid: 0 })];
    expect(buildMoney(draft)).toMatchObject({ advanceStatus: 'notSent' });
    const none = ws(); none.finance.invoices = []; none.finance.totals = { invoicedTotal: 0, collected: 0, outstanding: 0 };
    expect(buildMoney(none)).toMatchObject({ advanceStatus: 'notInvoiced', advancePending: 50000 });
  });

  test('a wedding with no accepted quotation shows only what the invoices say — no invented advance', () => {
    const w = ws();
    w.finance.agreement = null;
    w.finance.invoices = [invoice({ id: 'x', kind: 'OTHER', status: 'SENT', total: 30000, amountPaid: 10000, quotationId: null, bookingId: null })];
    w.finance.totals = { invoicedTotal: 30000, collected: 10000, outstanding: 20000 };
    expect(buildMoney(w)).toMatchObject({ mode: 'invoices', total: 30000, advance: null, received: 10000, balance: null });
  });

  test('no invoices and no agreement: an honest empty state, not zeros', () => {
    const w = ws(); w.finance.agreement = null; w.finance.invoices = []; w.finance.totals = { invoicedTotal: 0, collected: 0, outstanding: 0 };
    const m = buildMoney(w);
    expect(m.mode).toBe('none');
    expect(m.headline).toContain('nothing has been billed');
  });
});

describe('the pulse, vendors, functions and tasks', () => {
  test('vendor states: confirmed / pending / declined, plus quoted services that still have no vendor', () => {
    const w = ws({
      events: [fn('e1', 'WEDDING', 'Wedding', day(60), [vb('1', 'Rajdhani Palace', 'Venue', 'CONFIRMED'), vb('2', 'Lens Studio', 'Photography', 'PENDING_VENDOR_CONFIRMATION'), vb('3', 'Old DJ', 'DJ', 'DECLINED'), vb('4', 'Gone', 'Music', 'CANCELLED')])],
      tasks: [{ id: 't1', title: 'Assign a vendor for "Decoration"', description: null, status: 'PENDING', priority: 'MEDIUM', dueAt: null, completedAt: null, assignedToName: null, createdAt: day(-9) }],
    });
    const view = buildControlRoom(w, NOW);
    expect(view.vendors.map((v) => `${v.name}:${v.state}`)).toEqual(['Rajdhani Palace:confirmed', 'Lens Studio:pending', 'Old DJ:declined', 'Decoration:unassigned']);
    const pulse = Object.fromEntries(view.pulse.map((p) => [p.key, p]));
    expect(pulse.vendors.value).toBe('1 confirmed · 1 pending · 1 declined · 1 to assign');
    expect(pulse.vendors.tone).toBe('bad');
    expect(pulse.venue).toMatchObject({ value: 'Confirmed', tone: 'ok', detail: 'Rajdhani Palace' });
  });

  test('a done "assign a vendor" task is not listed as unassigned', () => {
    const w = ws({ tasks: [{ id: 't1', title: 'Assign a vendor for "Decoration"', description: null, status: 'DONE', priority: 'MEDIUM', dueAt: null, completedAt: day(-1), assignedToName: null, createdAt: day(-9) }] });
    expect(buildControlRoom(w, NOW).vendors.some((v) => v.state === 'unassigned')).toBe(false);
  });

  test('venue pending / not booked', () => {
    const pending = ws({ events: [fn('e1', 'WEDDING', null, day(60), [vb('1', 'Rajdhani Palace', 'Venue', 'PENDING_VENDOR_CONFIRMATION')])] });
    expect(buildControlRoom(pending, NOW).pulse.find((p) => p.key === 'venue')).toMatchObject({ value: 'Awaiting confirmation', tone: 'warn' });
    const none = ws({ events: [fn('e1', 'WEDDING', null, day(60))] });
    expect(buildControlRoom(none, NOW).pulse.find((p) => p.key === 'venue')).toMatchObject({ value: 'Not booked yet', tone: 'neutral' });
    expect(buildControlRoom(none, NOW).pulse.find((p) => p.key === 'vendors')?.value).toBe('None yet');
  });

  test('tasks: open and overdue counted from real dates; an empty list says "No tasks yet", not "0 open"', () => {
    const t = (id: string, status: 'PENDING' | 'DONE', due: string | null, title = id) => ({ id, title, description: null, status, priority: 'MEDIUM' as const, dueAt: due, completedAt: null, assignedToName: null, createdAt: day(-9) });
    const w = ws({ tasks: [t('a', 'PENDING', day(-3)), t('b', 'PENDING', day(0), 'Call the caterer'), t('c', 'PENDING', day(4), 'Book the pandit'), t('d', 'DONE', day(-5)), t('e', 'PENDING', null)] });
    const view = buildControlRoom(w, NOW);
    expect(view.tasks).toMatchObject({ total: 5, open: 4, overdue: 1 });
    expect(view.tasks.dueToday).toEqual([{ id: 'b', title: 'Call the caterer' }]);
    expect(view.tasks.next?.title).toBe('Book the pandit'); // the next task AFTER today; today's is under dueToday
    expect(view.pulse.find((p) => p.key === 'tasks')).toMatchObject({ value: '4 open · 1 overdue', tone: 'bad' });
    expect(buildControlRoom(ws(), NOW).pulse.find((p) => p.key === 'tasks')).toMatchObject({ value: 'No tasks yet', tone: 'neutral' });
  });

  test('functions: name, date, place and how many of their services are confirmed', () => {
    const w = ws({
      events: [
        fn('h', 'HALDI', 'Haldi', day(58), [vb('1', 'A', 'Decoration', 'CONFIRMED'), vb('2', 'B', 'Catering', 'PENDING_VENDOR_CONFIRMATION')], { venueName: 'Lawn' }),
        fn('m', 'MEHENDI', null, day(59)),
        fn('w', 'WEDDING', 'Wedding', day(60), [vb('3', 'Rajdhani', 'Venue', 'CONFIRMED')]),
      ],
    });
    const f = buildControlRoom(w, NOW).functions;
    expect(f.map((x) => `${x.name}|${x.services}|${x.place}`)).toEqual(['Haldi|1 of 2 services confirmed|Lawn, Patna', 'Mehendi|No services yet|Patna', 'Wedding|1 of 1 service confirmed|Patna']);
  });

  test('today and upcoming: today\'s function and tasks; the next function and the next dated task', () => {
    const w = ws({
      events: [fn('a', 'HALDI', 'Haldi', day(0)), fn('b', 'WEDDING', 'Wedding', day(2))],
      wedding: { ...ws().wedding, primaryDate: day(2) },
      tasks: [{ id: 't', title: 'Confirm the band', description: null, status: 'PENDING', priority: 'LOW', dueAt: day(0), completedAt: null, assignedToName: null, createdAt: day(-9) }, { id: 'u', title: 'Print menus', description: null, status: 'PENDING', priority: 'LOW', dueAt: day(1), completedAt: null, assignedToName: null, createdAt: day(-9) }],
    });
    const view = buildControlRoom(w, NOW);
    expect(view.todayItems.map((i) => i.label)).toEqual(['Haldi · Patna', 'Confirm the band']);
    expect(view.upcomingItems.map((i) => `${i.label} ${i.when}`)).toEqual([`Wedding · ${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(day(2)))} in 2 days`, 'Print menus tomorrow']);
  });

  test('nothing scheduled: both lists are simply empty', () => {
    const view = buildControlRoom(ws(), NOW);
    expect(view.todayItems).toEqual([]);
  });
});

describe('small helpers', () => {
  test('whenWords', () => {
    expect([whenWords(0), whenWords(1), whenWords(-1), whenWords(12), whenWords(-4), whenWords(null)]).toEqual(['today', 'tomorrow', 'yesterday', 'in 12 days', '4 days ago', null]);
  });
  test('unassignedServiceFromTask reads only the conversion\'s own task titles', () => {
    expect(unassignedServiceFromTask('Assign a vendor for "Photography"')).toBe('Photography');
    expect(unassignedServiceFromTask('Assign replacement vendor for "DJ"')).toBe('DJ');
    expect(unassignedServiceFromTask('Call the caterer')).toBeNull();
  });
});

describe('review fixes from the browser test', () => {
  const task = (title: string) => ({ id: 't', title, description: null, status: 'PENDING' as const, priority: 'MEDIUM' as const, dueAt: null, completedAt: null, assignedToName: null, createdAt: day(-9) });

  test('a quoted venue that has no vendor yet reads as "No vendor yet" in the venue card — not "Not booked yet"', () => {
    const w = ws({ events: [fn('e1', 'WEDDING', null, day(60))], tasks: [task('Assign a vendor for "Marriage hall"')] });
    const pulse = buildControlRoom(w, NOW).pulse;
    expect(pulse.find((p) => p.key === 'venue')).toMatchObject({ value: 'No vendor yet', tone: 'warn' });
    expect(pulse.find((p) => p.key === 'vendors')?.value).toBe('1 to assign');
  });

  test('the countdown shows only while the wedding is still coming up or happening', () => {
    expect(buildControlRoom(ws(), NOW).when).toBe('in 60 days');
    for (const status of ['COMPLETED', 'CANCELLED', 'POSTPONED'] as const) {
      expect(buildControlRoom(ws({ wedding: { ...ws().wedding, status } }), NOW).when).toBeNull();
    }
  });
});

describe('vendor follow-up tasks are shown as vendors, not as tasks', () => {
  const t = (id: string, title: string, over: Record<string, unknown> = {}) => ({ id, title, description: null, status: 'PENDING' as const, priority: 'HIGH' as const, dueAt: null, completedAt: null, assignedToName: null, createdAt: day(-9), ...over });
  const settle = (w: WeddingWorkspace) => { w.finance.invoices = [invoice({ id: 'a', kind: 'ADVANCE', status: 'PAID', total: 50000, amountPaid: 50000 })]; return w; };

  test('they are not counted or listed as tasks, and never become the "open task" next action', () => {
    const w = settle(ws({ tasks: [t('1', 'Confirm booking with Lens Studio for "Photography"'), t('2', 'Assign a vendor for "Decoration"'), t('3', 'Send save-the-date cards', { priority: 'LOW', dueAt: day(3) })] }));
    const view = buildControlRoom(w, NOW);
    expect(view.tasks).toMatchObject({ total: 1, open: 1 });
    expect(view.pulse.find((p) => p.key === 'tasks')?.value).toBe('1 open');
  });

  test('an unassigned service is an ASSIGN_VENDOR action that opens the Plan tab, with the quoted price ready for the form', () => {
    const w = settle(ws({
      events: [fn('e1', 'WEDDING', null, day(60), [vb('1', 'Rajdhani Palace', 'Venue', 'CONFIRMED')])],
      tasks: [t('9', 'Assign a vendor for "Photography"', { description: 'Quoted as a custom line (Photography): 1 × ₹12,500 = ₹12,500. Choose the vendor and add the vendor booking.', weddingEventId: 'e1' })],
    }));
    const view = buildControlRoom(w, NOW);
    expect(view.next).toMatchObject({ kind: 'ASSIGN_VENDOR', title: 'Assign a vendor for Photography', target: 'plan' });
    expect(view.attention.map((a) => a.kind)).toEqual(['ASSIGN_VENDOR']);
    expect(view.vendors.find((v) => v.state === 'unassigned')).toMatchObject({ name: 'Photography', taskId: '9', weddingEventId: 'e1', quotedPrice: 12500 });
  });

  test('a pending vendor booking carries what confirming needs, and the action opens the Plan tab', () => {
    const w = ws({ events: [fn('e1', 'WEDDING', null, day(60), [vb('vb1', 'Lens Studio', 'Photography', 'PENDING_VENDOR_CONFIRMATION')])] });
    const view = buildControlRoom(w, NOW);
    expect(view.vendors[0]).toMatchObject({ state: 'pending', vendorBookingId: 'vb1', weddingEventId: 'e1' });
    expect(view.next.target).toBe('plan');
  });
});
