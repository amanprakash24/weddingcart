/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { Role } from '@/lib/auth/roles';

// Assigned-only money (founder decisions, 21 Nov 2026), end to end through the real routes, the real guard
// (lib/auth/moneyGuard.ts), the real loader (services/moneyAccess.service.ts) and the real rules (lib/auth/moneyAccess.ts) —
// only the database rows, the session and the business services behind the routes are fakes.
//
//   wedding w1: coordinator "ops", booked from lead L1 owned by "rep"
//   wedding w2: nobody assigned
//   lead L1 (booked as w1), lead L2 owned by "rep" (not booked), lead L3 unassigned; quotation q2 is for lead L2.

const db = {
  weddings: {
    w1: { coordinatorId: 'ops', sourceLead: { assignedToId: 'rep' }, sourceEnquiry: null, sourceConsultation: null },
    w2: { coordinatorId: null, sourceLead: null, sourceEnquiry: null, sourceConsultation: null },
  } as Record<string, unknown>,
  leads: {
    L1: { assignedToId: 'rep', wedding: { coordinatorId: 'ops' } },
    L2: { assignedToId: 'rep', wedding: null },
    L3: { assignedToId: null, wedding: null },
  } as Record<string, unknown>,
  quotations: { q2: { leadId: 'L2', enquiryId: null, consultationId: null } } as Record<string, unknown>,
};
const byId = (table: Record<string, unknown>) => mock(async ({ where }: { where: { id: string } }) => table[where.id] ?? null);
mock.module('@/lib/prisma', () => ({
  prisma: {
    wedding: { findUnique: byId(db.weddings) },
    lead: { findUnique: byId(db.leads) },
    enquiry: { findUnique: mock(async () => null) },
    consultation: { findUnique: mock(async () => null) },
    quotation: { findUnique: byId(db.quotations) },
  },
}));

type Session = { user: { id: string; roles: Role[] } } | null;
const session = { current: null as Session };
const requireRole = mock(async (allowed: Role[]) =>
  session.current && session.current.user.roles.some((r) => allowed.includes(r)) ? session.current : null
);
mock.module('@/lib/auth/session', () => ({ requireRole, getSession: mock(async () => session.current) }));

const issueInvoice = mock(async () => ({ id: 'inv1', status: 'SENT' }));
mock.module('@/services/invoiceWorkflow.service', () => ({
  invoiceWorkflowService: { issueInvoice, createBalanceInvoice: mock(async () => ({})), recordManualPayment: mock(async () => ({})) },
  findAgreementForWedding: mock(async () => null),
  findWeddingsForClientPhone: mock(async () => []),
  standaloneInvoiceWarning: () => '',
}));
const workspaceFixture = {
  events: [{ id: 'e1', vendorBookings: [{ id: 'vb1', agreedPrice: 90000, payout: null }] }],
  finance: { budget: { planned: null, committed: 90000, variance: null }, invoices: [{ id: 'inv1' }], totals: { invoicedTotal: 1, collected: 1, outstanding: 0 }, agreement: null },
  activity: [{ id: 'a1', summary: 'Payment received: ₹50,000 via upi', detail: null }],
};
const assignCoordinator = mock(async () => ({}));
const updateVendorBookingStatus = mock(async () => ({ id: 'vb1', status: 'CONFIRMED', agreedPrice: 90000 }));
const updateVendorBookingPrice = mock(async () => ({ id: 'vb1', agreedPrice: 95000 }));
const listForWedding = mock(async () => [{ id: 'ap1', title: 'Decor upgrade', amount: 40000 }]);
const createApproval = mock(async () => ({ id: 'ap2' }));
mock.module('@/services/approval.service', () => ({ approvalService: { listForWedding, create: createApproval } }));
const bookingList = mock(async () => ({ data: [{ id: 'b1', status: 'NEW', name: 'Priya', total: 250000, items: [{ price: 125000, quantity: 2 }] }] }));
const bookingGet = mock(async () => ({ id: 'b1', status: 'NEW', items: [], total: 1, phone: '9', name: 'x', city: 'y' }));
const bookingUpdate = mock(async (id: string, d: { status: string }) => ({ id, status: d.status, total: 250000, items: [] }));
mock.module('@/services/booking.service', () => ({ bookingService: { list: bookingList, getById: bookingGet, update: bookingUpdate } }));
mock.module('@/lib/whatsapp', () => ({ sendWhatsAppMessage: mock(async () => ({ ok: true })) }));
class FakeInvalidBookingStateError extends Error {}
mock.module('@/services/weddingConversion.service', () => ({ convertBookingToWedding: mock(async () => ({})), convertLeadToWedding: mock(async () => ({})), InvalidBookingStateError: FakeInvalidBookingStateError }));
mock.module('@/services/weddingWorkspace.service', () => ({
  weddingWorkspaceService: { getWorkspace: mock(async () => structuredClone(workspaceFixture)), assignCoordinator, updateVendorBookingStatus, updateVendorBookingPrice },
}));
const assignLead = mock(async () => ({}));
mock.module('@/services/leadWorkspace.service', () => ({ leadWorkspaceService: { assignLead } }));
const listForSource = mock(async () => []);
const getById = mock(async () => ({ id: 'q2' }));
mock.module('@/services/quotation.service', () => ({ quotationService: { listForSource, getById, update: mock(async () => ({})), deleteDraft: mock(async () => undefined) } }));

const issue = await import('./[id]/invoices/[invoiceId]/issue/route');
const ws = await import('./[id]/workspace/route');
const coordinator = await import('./[id]/coordinator/route');
const assign = await import('../crm/leads/[sourceType]/[id]/assign/route');
const quotations = await import('../quotations/route');
const quotation = await import('../quotations/[id]/route');
const vendorBooking = await import('./[id]/vendor-bookings/[vbId]/route');
const approvals = await import('./[id]/approvals/route');
const bookings = await import('../bookings/route');
const booking = await import('../bookings/[id]/route');

const as = (id: string, ...roles: Role[]) => { session.current = { user: { id, roles } }; };
const founder = () => as('f', Role.SUPER_ADMIN);
const req = (url: string, method = 'GET', body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

const issueOn = (weddingId: string) => issue.POST(req('/x', 'POST'), { params: Promise.resolve({ id: weddingId, invoiceId: 'inv1' }) });
const workspaceOf = async (weddingId: string) => (await (await ws.GET(req('/x'), { params: Promise.resolve({ id: weddingId }) })).json()).data;

beforeEach(() => {
  session.current = null;
  for (const fn of [issueInvoice, assignCoordinator, assignLead, listForSource, getById]) fn.mockClear();
});

describe('wedding money routes (issue invoice needs full access)', () => {
  test('coordinator → allowed', async () => {
    as('ops', Role.OPERATIONS);
    expect((await issueOn('w1')).status).toBe(200);
    expect(issueInvoice).toHaveBeenCalled();
  });
  test('the rep who owned the lead → 403 (read-only after booking), nothing changed', async () => {
    as('rep', Role.SALES);
    const res = await issueOn('w1');
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain('see this wedding');
    expect(issueInvoice).not.toHaveBeenCalled();
  });
  test('another team member → 403', async () => {
    as('someone', Role.OPERATIONS);
    expect((await issueOn('w1')).status).toBe(403);
    expect(issueInvoice).not.toHaveBeenCalled();
  });
  test('unassigned wedding → 403 for the team, allowed for the founder', async () => {
    as('ops', Role.OPERATIONS);
    expect((await issueOn('w2')).status).toBe(403);
    founder();
    expect((await issueOn('w2')).status).toBe(200);
  });
  test('an unknown wedding id is refused like someone else’s (403), not revealed', async () => {
    as('ops', Role.OPERATIONS);
    expect((await issueOn('nope')).status).toBe(403);
  });
  test('signed out → 401', async () => {
    expect((await issueOn('w1')).status).toBe(401);
  });
});

describe('Wedding Control Room payload is trimmed per person', () => {
  test('coordinator: money present; flags say vendor money yes, commission no', async () => {
    as('ops', Role.OPERATIONS);
    const data = await workspaceOf('w1');
    expect(data.money).toEqual({ access: 'full', vendorMoney: true, commission: false, assign: false });
    expect(data.finance.invoices).toHaveLength(1);
    expect(data.events[0].vendorBookings[0].agreedPrice).toBe(90000);
  });
  test('former lead owner: read — invoices kept, vendor price withheld', async () => {
    as('rep', Role.SALES);
    const data = await workspaceOf('w1');
    expect(data.money.access).toBe('read');
    expect(data.finance.invoices).toHaveLength(1);
    expect(data.events[0].vendorBookings[0].agreedPrice).toBe(0);
  });
  test('anyone else: none — no invoices, no prices, amounts masked in the timeline', async () => {
    as('someone', Role.SALES);
    const data = await workspaceOf('w1');
    expect(data.money.access).toBe('none');
    expect(data.finance.invoices).toEqual([]);
    expect(data.events[0].vendorBookings[0].agreedPrice).toBe(0);
    expect(data.activity[0].summary).not.toContain('50,000');
  });
  test('founder: everything, including the right to assign', async () => {
    founder();
    const data = await workspaceOf('w2');
    expect(data.money).toEqual({ access: 'full', vendorMoney: true, commission: true, assign: true });
  });
});

describe('only the founder assigns', () => {
  test.each([[Role.SALES], [Role.OPERATIONS]])('%s cannot assign a lead (403), even to themselves', async (role) => {
    as('rep', role);
    const res = await assign.PATCH(req('/x', 'PATCH', { assignedToId: 'rep' }), { params: Promise.resolve({ sourceType: 'LEAD', id: 'L3' }) });
    expect(res.status).toBe(403);
    expect(assignLead).not.toHaveBeenCalled();
  });
  test('the founder assigns a lead', async () => {
    founder();
    const res = await assign.PATCH(req('/x', 'PATCH', { assignedToId: 'rep' }), { params: Promise.resolve({ sourceType: 'LEAD', id: 'L3' }) });
    expect(res.status).toBe(200);
  });
  test('the coordinator cannot hand the wedding to someone else; the founder can', async () => {
    as('ops', Role.OPERATIONS);
    const call = () => coordinator.PATCH(req('/x', 'PATCH', { coordinatorId: 'other' }), { params: Promise.resolve({ id: 'w1' }) });
    expect((await call()).status).toBe(403);
    expect(assignCoordinator).not.toHaveBeenCalled();
    founder();
    expect((await call()).status).toBe(200);
  });
});

describe('quotations follow the lead they belong to', () => {
  const list = (leadId: string) => quotations.GET(req(`/api/quotations?sourceType=LEAD&sourceId=${leadId}`));
  test('the rep the lead is assigned to sees its quotes', async () => {
    as('rep', Role.SALES);
    expect((await list('L2')).status).toBe(200);
    expect((await quotation.GET(req('/x'), { params: Promise.resolve({ id: 'q2' }) })).status).toBe(200);
  });
  test('another rep does not (403), and the service is never asked', async () => {
    as('other', Role.SALES);
    expect((await list('L2')).status).toBe(403);
    expect((await quotation.GET(req('/x'), { params: Promise.resolve({ id: 'q2' }) })).status).toBe(403);
    expect(listForSource).not.toHaveBeenCalled();
    expect(getById).not.toHaveBeenCalled();
  });
  test('an unassigned lead’s quotes: founder only', async () => {
    as('rep', Role.SALES);
    expect((await list('L3')).status).toBe(403);
    founder();
    expect((await list('L3')).status).toBe(200);
  });
  test('after booking the rep may still read the quotes, but not change them', async () => {
    as('rep', Role.SALES);
    expect((await list('L1')).status).toBe(200);
  });
});

describe('vendor bookings: coordination open to the team, money to the coordinator and founder', () => {
  const patchVb = (body: unknown) => vendorBooking.PATCH(req('/x', 'PATCH', body), { params: Promise.resolve({ id: 'w1', vbId: 'vb1' }) });
  test('anyone on the team records a vendor’s yes — and does not get the vendor price back', async () => {
    as('someone', Role.SALES);
    const res = await patchVb({ status: 'CONFIRMED' });
    expect(res.status).toBe(200);
    expect((await res.json()).data.agreedPrice).toBeNull();
  });
  test('the coordinator gets the price back', async () => {
    as('ops', Role.OPERATIONS);
    expect((await (await patchVb({ status: 'CONFIRMED' })).json()).data.agreedPrice).toBe(90000);
  });
  test('re-pricing or cancelling a vendor: refused for others and the read-only lead owner; allowed for the coordinator', async () => {
    for (const who of ['someone', 'rep']) {
      as(who, Role.SALES);
      expect((await patchVb({ agreedPrice: 95000 })).status).toBe(403);
      expect((await patchVb({ status: 'CANCELLED' })).status).toBe(403);
    }
    expect(updateVendorBookingPrice).not.toHaveBeenCalled();
    as('ops', Role.OPERATIONS);
    expect((await patchVb({ agreedPrice: 95000 })).status).toBe(200);
  });
});

describe('client approvals: open to the team, amounts follow the wedding’s money rule', () => {
  const list = () => approvals.GET(req('/x'), { params: Promise.resolve({ id: 'w1' }) });
  const create = (body: unknown) => approvals.POST(req('/x', 'POST', body), { params: Promise.resolve({ id: 'w1' }) });
  test('another team member sees approvals without amounts', async () => {
    as('someone', Role.SALES);
    const data = (await (await list()).json()).data;
    expect(data[0]).toEqual({ id: 'ap1', title: 'Decor upgrade', amount: null });
  });
  test('the read-only lead owner and the coordinator see the amount', async () => {
    for (const [id, role] of [['rep', Role.SALES], ['ops', Role.OPERATIONS]] as const) {
      as(id, role);
      expect((await (await list()).json()).data[0].amount).toBe(40000);
    }
  });
  test('asking the couple to approve an amount needs full access; an approval without an amount does not', async () => {
    as('someone', Role.SALES);
    expect((await create({ subjectType: 'MENU', title: 'Menu', amount: 5000 })).status).toBe(403);
    expect((await create({ subjectType: 'MENU', title: 'Menu' })).status).toBe(200);
    as('ops', Role.OPERATIONS);
    expect((await create({ subjectType: 'MENU', title: 'Menu', amount: 5000 })).status).toBe(200);
  });
});

describe('old cart Bookings: totals founder-only, follow-up open to the team', () => {
  test('a team member sees the bookings without totals or prices', async () => {
    as('someone', Role.SALES);
    const data = (await (await bookings.GET()).json()).data;
    expect(data[0]).toMatchObject({ name: 'Priya', total: null });
    expect(data[0].items[0].price).toBeNull();
  });
  test('the founder sees totals', async () => {
    founder();
    expect((await (await bookings.GET()).json()).data[0].total).toBe(250000);
  });
  test('a team member marks a booking contacted, but cannot confirm it', async () => {
    as('someone', Role.OPERATIONS);
    const put = (status: string) => booking.PUT(req('/x', 'PUT', { status }), { params: Promise.resolve({ id: 'b1' }) });
    const contacted = await put('contacted');
    expect(contacted.status).toBe(200);
    expect((await contacted.json()).data.total).toBeNull();
    expect((await put('confirmed')).status).toBe(403);
  });
});
