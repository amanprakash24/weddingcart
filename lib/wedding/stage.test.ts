/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import {
  computeWeddingStage, computeNextAction, listNextActions, checkCompletion, OPERATIONAL_STAGES, STAGE_LABELS, FINAL_WEEK_DAYS,
  type NextActionInput,
} from './stage';

// "Today" is Monday 21 Sep 2026, mid-morning in India.
const NOW = new Date('2026-09-21T04:30:00.000Z');
const day = (iso: string) => `${iso}T00:00:00.000Z`; // how a wedding date is stored: midnight UTC of the chosen day
const plusDays = (n: number) => day(new Date(Date.UTC(2026, 8, 21 + n)).toISOString().slice(0, 10));

// A wedding with nothing wrong with it; each test breaks one thing.
function wedding(over: Partial<NextActionInput> = {}): NextActionInput {
  return {
    status: 'ACTIVE',
    primaryDate: plusDays(60),
    functionDates: [plusDays(60)],
    now: NOW,
    coordinatorName: 'Asha',
    guestCount: 300,
    couple: { brideName: 'Priya', groomName: 'Rahul' },
    tasks: [],
    vendorBookings: [],
    invoices: [{ status: 'SENT', outstanding: 0 }],
    ...over,
  };
}

describe('computeWeddingStage', () => {
  test('Booking Confirmed is not a stage — it is the commercial milestone that creates the wedding', () => {
    expect(OPERATIONAL_STAGES).toEqual(['PLANNING', 'FINAL_WEEK', 'WEDDING_DAY', 'COMPLETED']);
    expect(Object.keys(STAGE_LABELS)).not.toContain('BOOKING_CONFIRMED');
  });

  test('a wedding far away is Planning', () => {
    const info = computeWeddingStage(wedding());
    expect(info.stage).toBe('PLANNING');
    expect(info.daysToGo).toBe(60);
  });

  test('ACTIVE and PLANNING read the same — vendor confirmation does not decide the stage', () => {
    expect(computeWeddingStage(wedding({ status: 'PLANNING' })).stage).toBe('PLANNING');
    expect(computeWeddingStage(wedding({ status: 'ACTIVE' })).stage).toBe('PLANNING');
    // ...and they keep reading the same as the date closes in
    for (const n of [7, 0]) {
      const a = computeWeddingStage(wedding({ status: 'PLANNING', primaryDate: plusDays(n), functionDates: [plusDays(n)] }));
      const b = computeWeddingStage(wedding({ status: 'ACTIVE', primaryDate: plusDays(n), functionDates: [plusDays(n)] }));
      expect(a).toEqual(b);
    }
  });

  test('boundaries: 8 days out is Planning, 7 is Final week, 1 is Final week, today is Wedding day', () => {
    const at = (n: number) => computeWeddingStage(wedding({ primaryDate: plusDays(n), functionDates: [plusDays(n)] }));
    expect(FINAL_WEEK_DAYS).toBe(7);
    expect(at(8).stage).toBe('PLANNING');
    expect(at(7).stage).toBe('FINAL_WEEK');
    expect(at(1).stage).toBe('FINAL_WEEK');
    expect(at(0).stage).toBe('WEDDING_DAY');
    expect(at(0).daysToGo).toBe(0);
  });

  test('Postpone/Cancel are offered before the wedding day and not from the wedding day on', () => {
    const at = (n: number) => computeWeddingStage(wedding({ primaryDate: plusDays(n), functionDates: [plusDays(n)] }));
    expect(at(30).canPostponeOrCancel).toBe(true);
    expect(at(1).canPostponeOrCancel).toBe(true);
    expect(at(0).canPostponeOrCancel).toBe(false);
    expect(at(-1).canPostponeOrCancel).toBe(false);
  });

  test('a wedding that is over but not closed stays Wedding day and asks to be closed', () => {
    const info = computeWeddingStage(wedding({ primaryDate: plusDays(-3), functionDates: [plusDays(-3)] }));
    expect(info.stage).toBe('WEDDING_DAY');
    expect(info.needsClosing).toBe(true);
    expect(info.canComplete).toBe(true);
    expect(info.daysToGo).toBe(-3);
  });

  test('on the wedding day itself it is Wedding day, can be completed once the last day arrives, and needs no closing yet', () => {
    const info = computeWeddingStage(wedding({ primaryDate: plusDays(0), functionDates: [plusDays(0)] }));
    expect(info).toMatchObject({ stage: 'WEDDING_DAY', needsClosing: false, canComplete: true });
  });

  test('a multi-day wedding runs from its first function to its last', () => {
    const functionDates = [plusDays(-1), plusDays(1)]; // Mehendi yesterday, Reception tomorrow
    const primaryDate = plusDays(0);
    const info = computeWeddingStage(wedding({ primaryDate, functionDates }));
    expect(info.stage).toBe('WEDDING_DAY'); // started yesterday
    expect(info.canComplete).toBe(false); // reception is tomorrow
    expect(info.needsClosing).toBe(false);
    const after = computeWeddingStage(wedding({ primaryDate, functionDates, now: new Date('2026-09-23T04:30:00.000Z') }));
    expect(after).toMatchObject({ stage: 'WEDDING_DAY', canComplete: true, needsClosing: true });
  });

  test('Final week counts from the FIRST function, not the main date', () => {
    const info = computeWeddingStage(wedding({ primaryDate: plusDays(20), functionDates: [plusDays(5), plusDays(20)] }));
    expect(info.stage).toBe('FINAL_WEEK');
    expect(info.daysToGo).toBe(5);
  });

  test('a vendorless / venue-only wedding can be completed once the day has come', () => {
    // no vendor bookings anywhere in the input — nothing about it depends on them
    const past = wedding({ status: 'PLANNING', primaryDate: plusDays(-1), functionDates: [plusDays(-1)], vendorBookings: [] });
    expect(computeWeddingStage(past).canComplete).toBe(true);
    expect(checkCompletion(past).allowed).toBe(true);
  });

  test('recorded outcomes win over the calendar', () => {
    const near = { primaryDate: plusDays(2), functionDates: [plusDays(2)] };
    expect(computeWeddingStage(wedding({ ...near, status: 'COMPLETED' })).stage).toBe('COMPLETED');
    expect(computeWeddingStage(wedding({ ...near, status: 'CANCELLED' })).stage).toBe('CANCELLED');
    expect(computeWeddingStage(wedding({ ...near, status: 'POSTPONED' })).stage).toBe('POSTPONED');
    for (const status of ['COMPLETED', 'CANCELLED', 'POSTPONED'] as const) {
      expect(computeWeddingStage(wedding({ ...near, status }))).toMatchObject({ canPostponeOrCancel: false, canComplete: false, needsClosing: false });
    }
  });

  test('a Completed wedding whose date is long past is Completed, not "needs closing"', () => {
    const info = computeWeddingStage(wedding({ status: 'COMPLETED', primaryDate: plusDays(-90), functionDates: [plusDays(-90)] }));
    expect(info).toMatchObject({ stage: 'COMPLETED', needsClosing: false });
  });

  test('days are Indian calendar days: 00:30 IST on the wedding day is already the wedding day', () => {
    const w = { primaryDate: '2026-09-21T00:00:00.000Z', functionDates: ['2026-09-21T00:00:00.000Z'] };
    expect(computeWeddingStage(wedding({ ...w, now: new Date('2026-09-20T19:00:00.000Z') })).stage).toBe('WEDDING_DAY'); // 21 Sep 00:30 IST
    expect(computeWeddingStage(wedding({ ...w, now: new Date('2026-09-20T18:00:00.000Z') })).stage).toBe('FINAL_WEEK'); // 20 Sep 23:30 IST
  });

  test('accepts Date objects as well as ISO strings', () => {
    const d = new Date(plusDays(10));
    expect(computeWeddingStage(wedding({ primaryDate: d, functionDates: [d] })).daysToGo).toBe(10);
  });

  test('an unreadable date does not crash — it reads as Planning with no countdown', () => {
    const info = computeWeddingStage(wedding({ primaryDate: 'sometime in winter', functionDates: [] }));
    expect(info).toMatchObject({ stage: 'PLANNING', daysToGo: null, canPostponeOrCancel: true, canComplete: false });
  });
});

describe('computeNextAction — priority order', () => {
  const overdueUrgent = { title: 'Pay the tent advance', status: 'PENDING' as const, priority: 'URGENT' as const, dueAt: plusDays(-2) };
  const pendingVendor = { vendorName: 'Lens Studio', vendorCategory: 'Photography', status: 'PENDING_VENDOR_CONFIRMATION' as const, eventDate: plusDays(60) };
  const draftInvoice = { status: 'DRAFT' as const, outstanding: 50_000 };
  const openTask = { title: 'Finalise the menu', status: 'PENDING' as const, priority: 'MEDIUM' as const, dueAt: plusDays(10) };

  test('7. on track when nothing is wrong', () => {
    expect(computeNextAction(wedding())).toMatchObject({ kind: 'ON_TRACK', priority: 7, title: 'Everything is on track' });
  });

  test('on the wedding day "on track" says so', () => {
    const a = computeNextAction(wedding({ primaryDate: plusDays(0), functionDates: [plusDays(0)] }));
    expect(a.kind).toBe('ON_TRACK');
    expect(a.title).toContain('wedding day');
  });

  test('6. an open task', () => {
    expect(computeNextAction(wedding({ tasks: [openTask] }))).toMatchObject({ kind: 'OPEN_TASK', priority: 6, title: 'Finalise the menu' });
  });

  test('6. open tasks: the earliest-due first, undated last, ties broken by importance', () => {
    const tasks = [
      { title: 'Undated', status: 'PENDING' as const, priority: 'URGENT' as const, dueAt: null },
      { title: 'Later', status: 'PENDING' as const, priority: 'HIGH' as const, dueAt: plusDays(20) },
      { title: 'Sooner low', status: 'IN_PROGRESS' as const, priority: 'LOW' as const, dueAt: plusDays(5) },
      { title: 'Sooner high', status: 'PENDING' as const, priority: 'HIGH' as const, dueAt: plusDays(5) },
    ];
    const a = computeNextAction(wedding({ tasks }));
    expect(a.title).toBe('Sooner high');
    expect(a.detail).toBe('3 more tasks after this.');
  });

  test('done and cancelled tasks are not open', () => {
    const tasks = [{ ...openTask, status: 'DONE' as const }, { ...openTask, status: 'CANCELLED' as const }];
    expect(computeNextAction(wedding({ tasks })).kind).toBe('ON_TRACK');
  });

  test('5. missing essential information beats an open task', () => {
    const a = computeNextAction(wedding({ tasks: [openTask], couple: { brideName: 'Priya', groomName: null } }));
    expect(a).toMatchObject({ kind: 'MISSING_INFORMATION', priority: 5, target: 'people' });
    expect(a.title).toContain("bride's and groom's names");
  });

  test('5. no couple record, no guest count and no functions are each named', () => {
    const a = computeNextAction(wedding({ couple: null, guestCount: null, functionDates: [] }));
    expect(a.title).toBe("Add the bride's and groom's names, the guest count, the functions");
    const guestsOnly = computeNextAction(wedding({ guestCount: 0 }));
    expect(guestsOnly.title).toBe('Add the guest count');
    const functionsOnly = computeNextAction(wedding({ functionDates: [] }));
    expect(functionsOnly).toMatchObject({ title: 'Add the functions', target: 'functions' });
  });

  test('5. blank names count as missing', () => {
    expect(computeNextAction(wedding({ couple: { brideName: '  ', groomName: 'Rahul' } })).kind).toBe('MISSING_INFORMATION');
  });

  test('4. a missing coordinator beats missing information', () => {
    const a = computeNextAction(wedding({ coordinatorName: null, guestCount: null }));
    expect(a).toMatchObject({ kind: 'MISSING_COORDINATOR', priority: 4, title: 'Assign a coordinator' });
    expect(computeNextAction(wedding({ coordinatorName: '   ' })).kind).toBe('MISSING_COORDINATOR');
  });

  test('3. a draft invoice must be sent — and beats a missing coordinator', () => {
    const a = computeNextAction(wedding({ invoices: [draftInvoice], coordinatorName: null }));
    expect(a).toMatchObject({ kind: 'INVOICE_PAYMENT', priority: 3, title: 'Send the invoice to the couple', target: 'money' });
  });

  test('3. an advance invoice still in draft says "Send advance invoice"', () => {
    const a = computeNextAction(wedding({ invoices: [{ status: 'DRAFT', outstanding: 90_000, isAdvance: true }] }));
    expect(a).toMatchObject({ kind: 'INVOICE_PAYMENT', title: 'Send advance invoice' });
  });

  test('3. several drafts: never a single loose amount; an advance among them leads', () => {
    const two = computeNextAction(wedding({ invoices: [draftInvoice, draftInvoice] }));
    expect(two.title).toBe('Send 2 draft invoices to the couple');
    const withAdvance = computeNextAction(wedding({ invoices: [draftInvoice, { ...draftInvoice, isAdvance: true }] }));
    expect(withAdvance.title).toBe('Send advance invoice');
    expect(withAdvance.detail).toBe('1 other draft invoice is also waiting.');
  });

  test('3. one sent invoice with a balance: "Payment of ₹X pending" — never "Collect"; a link already sent is mentioned', () => {
    const noLink = computeNextAction(wedding({ invoices: [{ status: 'SENT', outstanding: 125_000 }] }));
    expect(noLink.title).toBe('Payment of ₹1,25,000 pending');
    expect(noLink.detail).toContain('Share a payment link');
    const withLink = computeNextAction(wedding({ invoices: [{ status: 'SENT', outstanding: 125_000, hasActivePaymentLink: true }] }));
    expect(withLink.detail).toContain('link has been sent');
  });

  test('3. when the invoice is known to be the advance, the wording says so', () => {
    const a = computeNextAction(wedding({ invoices: [{ status: 'SENT', outstanding: 90_000, isAdvance: true }] }));
    expect(a.title).toBe('Advance payment of ₹90,000 pending');
  });

  test('3. several unpaid invoices are NOT added into one number', () => {
    const a = computeNextAction(wedding({
      invoices: [{ status: 'SENT', outstanding: 1000 }, { status: 'SENT', outstanding: 2500 }, { status: 'PAID', outstanding: 0 }],
    }));
    expect(a.title).toBe('Payments pending on 2 invoices');
    expect(a.title).not.toContain('₹');
    const withAdvance = computeNextAction(wedding({
      invoices: [{ status: 'SENT', outstanding: 90_000, isAdvance: true }, { status: 'SENT', outstanding: 2500 }],
    }));
    expect(withAdvance.title).toBe('Advance payment pending');
  });

  test('3. paid invoices and zero balances are not an action', () => {
    expect(computeNextAction(wedding({ invoices: [{ status: 'PAID', outstanding: 0 }, { status: 'SENT', outstanding: 0 }] })).kind).toBe('ON_TRACK');
  });

  test('3. a wedding with no invoice is NOT assumed to need one', () => {
    expect(computeNextAction(wedding({ invoices: [] })).kind).toBe('ON_TRACK');
    expect(listNextActions(wedding({ invoices: [] })).some((a) => a.kind === 'INVOICE_PAYMENT')).toBe(false);
  });

  test('no next action ever says "Collect"', () => {
    const variants = [
      wedding({ invoices: [{ status: 'SENT', outstanding: 5000 }] }),
      wedding({ invoices: [{ status: 'SENT', outstanding: 5000, isAdvance: true }] }),
      wedding({ primaryDate: plusDays(-2), functionDates: [plusDays(-2)], invoices: [{ status: 'SENT', outstanding: 5000 }] }),
      wedding({ status: 'COMPLETED', invoices: [{ status: 'SENT', outstanding: 5000 }] }),
    ];
    for (const v of variants) for (const a of listNextActions(v)) expect(`${a.title} ${a.detail ?? ''}`).not.toContain('Collect');
  });

  test('2. a pending vendor confirmation beats invoices', () => {
    const a = computeNextAction(wedding({ vendorBookings: [pendingVendor], invoices: [draftInvoice] }));
    expect(a).toMatchObject({ kind: 'PENDING_VENDOR_CONFIRMATION', priority: 2, title: 'Get Lens Studio to confirm', target: 'plan' });
  });

  test('2. several pending vendors are counted and the nearest event leads', () => {
    const a = computeNextAction(wedding({
      vendorBookings: [
        { ...pendingVendor, vendorName: 'Later Decor', vendorCategory: 'Decoration', eventDate: plusDays(90) },
        { ...pendingVendor, vendorName: 'Sooner Band', vendorCategory: 'Music', eventDate: plusDays(40) },
        { ...pendingVendor, vendorName: 'Confirmed Co', status: 'CONFIRMED' as const },
      ],
    }));
    expect(a.title).toBe('2 vendors have not confirmed yet');
    expect(a.detail).toContain('Sooner Band');
  });

  test('confirmed, declined and cancelled vendors are not "pending"', () => {
    const others = (['CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED'] as const).map((status) => ({ ...pendingVendor, status }));
    expect(computeNextAction(wedding({ vendorBookings: others })).kind).toBe('ON_TRACK');
  });

  test('1. a HIGH/URGENT overdue task beats everything, even in Planning', () => {
    const a = computeNextAction(wedding({ tasks: [overdueUrgent], vendorBookings: [pendingVendor], invoices: [draftInvoice], coordinatorName: null }));
    expect(a).toMatchObject({ kind: 'CRITICAL_OVERDUE', priority: 1, title: 'Overdue: Pay the tent advance', target: 'plan' });
  });

  test('1. a LOW/MEDIUM overdue task is not critical while the wedding is far off — it is just the open task', () => {
    const late = { title: 'Order stationery', status: 'PENDING' as const, priority: 'LOW' as const, dueAt: plusDays(-5) };
    expect(computeNextAction(wedding({ tasks: [late], vendorBookings: [pendingVendor] })).kind).toBe('PENDING_VENDOR_CONFIRMATION');
    expect(computeNextAction(wedding({ tasks: [late] })).kind).toBe('OPEN_TASK');
  });

  test('1. in the final week ANY overdue task is critical', () => {
    const late = { title: 'Order stationery', status: 'PENDING' as const, priority: 'LOW' as const, dueAt: plusDays(-5) };
    const a = computeNextAction(wedding({ tasks: [late], primaryDate: plusDays(4), functionDates: [plusDays(4)] }));
    expect(a).toMatchObject({ kind: 'CRITICAL_OVERDUE', priority: 1 });
  });

  test('1. several overdue tasks are counted, earliest first', () => {
    const a = computeNextAction(wedding({
      tasks: [overdueUrgent, { ...overdueUrgent, title: 'Book the pandit', dueAt: plusDays(-6) }],
    }));
    expect(a.title).toBe('2 overdue tasks, starting with "Book the pandit"');
  });

  test('a task due today is not overdue', () => {
    const a = computeNextAction(wedding({ tasks: [{ ...overdueUrgent, dueAt: plusDays(0) }] }));
    expect(a.kind).toBe('OPEN_TASK');
  });

  test('listNextActions returns every applicable action, most urgent first', () => {
    const list = listNextActions(wedding({
      tasks: [overdueUrgent, openTask], vendorBookings: [pendingVendor], invoices: [draftInvoice], coordinatorName: null, guestCount: null,
    }));
    expect(list.map((a) => a.kind)).toEqual([
      'CRITICAL_OVERDUE', 'PENDING_VENDOR_CONFIRMATION', 'INVOICE_PAYMENT', 'MISSING_COORDINATOR', 'MISSING_INFORMATION', 'OPEN_TASK',
    ]);
    expect(list.map((a) => a.priority)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('never returns an empty list', () => {
    expect(listNextActions(wedding()).length).toBe(1);
  });
});

describe('computeNextAction — wedding day, closing, and outcomes', () => {
  const past = { primaryDate: plusDays(-2), functionDates: [plusDays(-2)] };

  test('after the last day with nothing else open, the action is to close the wedding', () => {
    expect(computeNextAction(wedding(past))).toMatchObject({ kind: 'CLOSE_WEDDING', title: 'Mark wedding as completed' });
  });

  test('after the last day, money owed comes before closing (payment is collected after the wedding)', () => {
    const a = computeNextAction(wedding({ ...past, invoices: [{ status: 'SENT', outstanding: 40_000 }] }));
    expect(a).toMatchObject({ kind: 'INVOICE_PAYMENT', title: 'Payment of ₹40,000 pending' });
  });

  test('a vendorless wedding reaches "close" without any vendor confirmation', () => {
    expect(computeNextAction(wedding({ ...past, status: 'PLANNING', vendorBookings: [] })).kind).toBe('CLOSE_WEDDING');
  });

  test('a completed wedding has nothing to plan, but an unpaid balance is still surfaced', () => {
    const done = wedding({ ...past, status: 'COMPLETED', tasks: [{ title: 'x', status: 'PENDING', priority: 'URGENT', dueAt: plusDays(-9) }], coordinatorName: null });
    expect(computeNextAction(done)).toMatchObject({ kind: 'NOTHING_TO_DO' });
    const owing = computeNextAction({ ...done, invoices: [{ status: 'SENT', outstanding: 9_000 }] });
    expect(owing).toMatchObject({ kind: 'INVOICE_PAYMENT', title: 'Payment of ₹9,000 pending' });
  });

  test('a cancelled wedding has nothing to do', () => {
    expect(computeNextAction(wedding({ status: 'CANCELLED', tasks: [{ title: 'x', status: 'PENDING', priority: 'URGENT', dueAt: plusDays(-9) }] }))).toMatchObject({ kind: 'NOTHING_TO_DO' });
  });

  test('a postponed wedding is told to resume when the new date is fixed', () => {
    expect(computeNextAction(wedding({ status: 'POSTPONED' }))).toMatchObject({ kind: 'RESUME_WEDDING' });
  });
});

describe('checkCompletion', () => {
  const over = { primaryDate: plusDays(-1), functionDates: [plusDays(-1)] };

  test('not allowed before the last day, and the reason is only the calendar', () => {
    const c = checkCompletion(wedding({ primaryDate: plusDays(3), functionDates: [plusDays(3)] }));
    expect(c).toEqual({ allowed: false, reason: 'The wedding has not reached its last day yet.', warnings: [] });
  });

  test('allowed on the last day with no warnings when everything is settled', () => {
    expect(checkCompletion(wedding({ primaryDate: plusDays(0), functionDates: [plusDays(0)] }))).toEqual({ allowed: true, reason: null, warnings: [] });
  });

  test('open tasks, unconfirmed vendors and money owed warn but do not block', () => {
    const c = checkCompletion(wedding({
      ...over,
      tasks: [{ title: 'a', status: 'PENDING', priority: 'LOW', dueAt: null }],
      vendorBookings: [{ vendorName: 'V', vendorCategory: 'C', status: 'PENDING_VENDOR_CONFIRMATION' }],
      invoices: [{ status: 'SENT', outstanding: 12_000 }, { status: 'DRAFT', outstanding: 5_000 }],
    }));
    expect(c.allowed).toBe(true);
    expect(c.warnings).toEqual(['1 open task', '1 vendor never confirmed', '₹12,000 unpaid on sent invoices', 'an invoice was never sent']);
  });

  test('already completed, cancelled and postponed weddings cannot be completed', () => {
    for (const status of ['COMPLETED', 'CANCELLED', 'POSTPONED'] as const) {
      expect(checkCompletion(wedding({ ...over, status })).allowed).toBe(false);
    }
  });
});

describe('invoice states feed the next action (issued invoices are not "unsent")', () => {
  test('an advance invoice that has been issued (SENT) no longer says "Send advance invoice"', () => {
    const a = computeNextAction(wedding({ invoices: [{ status: 'SENT', outstanding: 50_000, isAdvance: true }] }));
    expect(a.title).toBe('Advance payment of ₹50,000 pending');
    expect(a.title).not.toContain('Send');
  });

  test('a part-paid invoice asks for what is still pending on it', () => {
    const a = computeNextAction(wedding({ invoices: [{ status: 'PARTIALLY_PAID', outstanding: 30_000, isAdvance: true }] }));
    expect(a).toMatchObject({ kind: 'INVOICE_PAYMENT', title: 'Advance payment of ₹30,000 pending' });
  });

  test('a fully paid invoice is not an action', () => {
    expect(computeNextAction(wedding({ invoices: [{ status: 'PAID', outstanding: 0, isAdvance: true }] })).kind).toBe('ON_TRACK');
  });

  test('a balance invoice still in draft is "Send the invoice to the couple"; the paid advance beside it does not hide it', () => {
    const a = computeNextAction(wedding({ invoices: [{ status: 'PAID', outstanding: 0, isAdvance: true }, { status: 'DRAFT', outstanding: 60_000 }] }));
    expect(a.title).toBe('Send the invoice to the couple');
  });
});

describe('quoted services with no vendor yet are vendor work (priority 2, done on the Plan tab)', () => {
  const pendingVendor = { vendorName: 'Lens Studio', vendorCategory: 'Photography', status: 'PENDING_VENDOR_CONFIRMATION' as const, eventDate: plusDays(60) };
  test('one service → "Assign a vendor for X"', () => {
    expect(computeNextAction(wedding({ unassignedServices: ['Photography'] }))).toMatchObject({ kind: 'ASSIGN_VENDOR', priority: 2, title: 'Assign a vendor for Photography', target: 'plan' });
  });
  test('several services → counted, the first named', () => {
    const a = computeNextAction(wedding({ unassignedServices: ['Photography', 'Decoration'] }));
    expect(a.title).toBe('2 services have no vendor yet');
    expect(a.detail).toBe('Start with Photography.');
  });
  test('it sits with the other vendor work: after a pending confirmation, before invoices and the coordinator', () => {
    const list = listNextActions(wedding({ unassignedServices: ['Photography'], vendorBookings: [pendingVendor], invoices: [{ status: 'DRAFT', outstanding: 50_000 }], coordinatorName: null }));
    expect(list.map((x) => x.kind)).toEqual(['PENDING_VENDOR_CONFIRMATION', 'ASSIGN_VENDOR', 'INVOICE_PAYMENT', 'MISSING_COORDINATOR']);
  });
  test('a completed or cancelled wedding does not chase vendors', () => {
    expect(computeNextAction(wedding({ status: 'COMPLETED', unassignedServices: ['Photography'] })).kind).not.toBe('ASSIGN_VENDOR');
  });
});
