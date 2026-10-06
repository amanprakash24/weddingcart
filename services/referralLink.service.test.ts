/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { referralCrmView, referralTarget, validateConsultationDetails } from '@/lib/growthPartner/crmLink';

// Growth Partner referral → CRM (MASTER-GAP-ANALYSIS §2.4.3). A fake transaction; nothing real is created.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createReferralLinkService } = await import('./referralLink.service');

type Ref = { id: string; type: string; name: string; phone: string; city: string; requirement: string | null; notes: string | null; status: string; consultationId: string | null; vendorProspectId: string | null; partner: { code: string } };
let ref: Ref | null;
let openConsultation: { id: string } | null;
let existingProspect: { id: string } | null;
const tx = {
  $queryRaw: mock(async () => []),
  partnerReferral: {
    findUnique: mock(async () => (ref ? { ...ref } : null)),
    update: mock(async ({ data }: { data: Partial<Ref> }) => Object.assign(ref as Ref, data)),
  },
  consultation: {
    findFirst: mock(async (args?: unknown) => (void args, openConsultation)),
    create: mock(async (args: { data: Record<string, unknown> }) => (void args, { id: 'c-new' })),
  },
  vendorProspect: {
    findFirst: mock(async () => existingProspect),
    create: mock(async (args: { data: Record<string, unknown> }) => (void args, { id: 'p-new' })),
  },
  activityLog: { create: mock(async () => ({})) },
};
const service = createReferralLinkService({ db: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } as never });

beforeEach(() => {
  ref = { id: 'r1', type: 'CLIENT', name: 'Riya Sharma', phone: '+91 98765 43210', city: 'Patna', requirement: 'Venue for 300', notes: 'Wants December', status: 'SUBMITTED', consultationId: null, vendorProspectId: null, partner: { code: 'GP-1001' } };
  openConsultation = null;
  existingProspect = null;
  for (const m of [tx.consultation.create, tx.consultation.findFirst, tx.vendorProspect.create, tx.partnerReferral.update, tx.activityLog.create]) m.mockClear();
});

describe('rules', () => {
  test('a couple goes to the CRM, a venue or vendor to vendor prospects, an event nowhere yet', () => {
    expect(referralTarget('CLIENT')).toBe('CONSULTATION');
    expect(referralTarget('VENUE')).toBe('VENDOR_PROSPECT');
    expect(referralTarget('VENDOR')).toBe('VENDOR_PROSPECT');
    expect(referralTarget('EVENT')).toBeNull();
  });

  test('date and guests are optional, and checked', () => {
    expect(validateConsultationDetails({})).toEqual({ weddingDate: '', guestCount: 0 });
    expect(validateConsultationDetails({ weddingDate: '2026-12-12', guestCount: '300' })).toEqual({ weddingDate: '2026-12-12', guestCount: 300 });
    expect(validateConsultationDetails({ weddingDate: 'next winter' })).toHaveProperty('error');
    expect(validateConsultationDetails({ guestCount: -2 })).toHaveProperty('error');
  });

  test('the row shows the real CRM stage, or the wedding once booked', () => {
    const label = (s: string) => (s === 'QUOTATION_SENT' ? 'Quotation Sent' : s);
    expect(referralCrmView({ consultation: { id: 'c1', pipelineStage: 'QUOTATION_SENT', wedding: null } }, label)).toEqual({ kind: 'CONSULTATION', href: '/admin/crm/leads/CONSULTATION/c1', label: 'In CRM · Quotation Sent' });
    expect(referralCrmView({ consultation: { id: 'c1', pipelineStage: 'WON', wedding: { weddingNumber: 'WED-2026-0002' } } }, label)?.label).toBe('Booked · WED-2026-0002');
    expect(referralCrmView({ vendorProspect: { id: 'p1', status: 'INTERESTED' } }, label)?.label).toBe('Vendor prospect · Interested');
    expect(referralCrmView({}, label)).toBeNull();
  });
});

describe('sendToCrm', () => {
  test('a couple becomes a consultation carrying the partner code and their requirement; the referral keeps the link', async () => {
    const out = await service.sendToCrm('r1', { weddingDate: '2026-12-12', guestCount: 300 }, 'staff-1');
    expect(out).toEqual({ target: 'CONSULTATION', id: 'c-new', created: true });
    const data = (tx.consultation.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data).toMatchObject({ name: 'Riya Sharma', phone: '+91 98765 43210', city: 'Patna', weddingDate: '2026-12-12', guestCount: 300, days: 1 });
    expect(String(data.message)).toContain('GP-1001');
    expect(String(data.message)).toContain('Venue for 300');
    expect(ref?.consultationId).toBe('c-new');
    expect(ref?.status).toBe('SUBMITTED'); // the referral status stays staff-controlled
  });

  test('an open consultation with the same mobile is linked, not duplicated', async () => {
    openConsultation = { id: 'c-existing' };
    expect(await service.sendToCrm('r1', {}, null)).toEqual({ target: 'CONSULTATION', id: 'c-existing', created: false });
    expect(tx.consultation.create).not.toHaveBeenCalled();
    const where = (tx.consultation.findFirst.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where;
    expect(where.phone).toEqual({ endsWith: '9876543210' });
  });

  test('sending twice answers with the same link and creates nothing', async () => {
    await service.sendToCrm('r1', {}, null);
    tx.consultation.create.mockClear();
    expect(await service.sendToCrm('r1', {}, null)).toEqual({ target: 'CONSULTATION', id: 'c-new', created: false });
    expect(tx.consultation.create).not.toHaveBeenCalled();
  });

  test('a venue becomes a vendor prospect (source: the partner code)', async () => {
    (ref as Ref).type = 'VENUE';
    expect(await service.sendToCrm('r1', {}, null)).toEqual({ target: 'VENDOR_PROSPECT', id: 'p-new', created: true });
    expect((tx.vendorProspect.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data).toMatchObject({ name: 'Riya Sharma', city: 'Patna', source: 'growth-partner:GP-1001' });
  });

  test('refused: rejected referrals, event referrals, bad details, unknown referral', async () => {
    (ref as Ref).status = 'REJECTED';
    await expect(service.sendToCrm('r1', {}, null)).rejects.toBeInstanceOf(ConflictError);
    (ref as Ref).status = 'SUBMITTED';
    (ref as Ref).type = 'EVENT';
    await expect(service.sendToCrm('r1', {}, null)).rejects.toBeInstanceOf(ConflictError);
    (ref as Ref).type = 'CLIENT';
    await expect(service.sendToCrm('r1', { weddingDate: 'soon' }, null)).rejects.toBeInstanceOf(ValidationError);
    ref = null;
    await expect(service.sendToCrm('nope', {}, null)).rejects.toBeInstanceOf(NotFoundError);
  });
});
