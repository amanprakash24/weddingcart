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
mock.module('@/services/weddingWorkspace.service', () => ({
  weddingWorkspaceService: { getWorkspace: mock(async () => structuredClone(workspaceFixture)), assignCoordinator },
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
