/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { PARTNER_NOT_FOUND } from '@/lib/growthPartner/rules';

// Fakes only (createGrowthPartnerService(deps)); '@/lib/prisma' is stubbed because importing the service loads it.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createGrowthPartnerService } = await import('./growthPartner.service');

type Partner = { id: string; code: string; phone: string; status: string; [k: string]: unknown };
type Referral = { id: string; partnerId: string; status: string; payoutStatus: string; payoutAmount: number | null; completedAt: Date | null; paidAt: Date | null; [k: string]: unknown };
let partners: Partner[];
let referrals: Referral[];
let raceOnCreate = false;

const db = {
  growthPartner: {
    findUnique: mock(async (a: { where: { phone?: string; id?: string } }) => partners.find((p) => (a.where.phone ? p.phone === a.where.phone : p.id === a.where.id)) ?? null),
    findMany: mock(async () => partners),
    update: mock(async (a: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(partners.find((p) => p.id === a.where.id)!, a.data)),
    count: mock(async () => partners.length),
  },
  partnerReferral: {
    create: mock(async (a: { data: Record<string, unknown> & { partner: { connect: { id: string } } } }) => {
      const { partner, ...rest } = a.data;
      const r = { id: `r${referrals.length + 1}`, partnerId: partner.connect.id, status: 'SUBMITTED', payoutStatus: 'NOT_DUE', payoutAmount: null, completedAt: null, paidAt: null, ...rest } as Referral;
      referrals.push(r);
      return r;
    }),
    findUnique: mock(async (a: { where: { id: string } }) => referrals.find((r) => r.id === a.where.id) ?? null),
    findMany: mock(async () => referrals),
    update: mock(async (a: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(referrals.find((r) => r.id === a.where.id)!, a.data)),
    count: mock(async () => referrals.length),
    aggregate: mock(async () => ({ _sum: { payoutAmount: null } })),
  },
};
const createPartnerWithNextCode = mock(async (data: Record<string, unknown>) => {
  if (raceOnCreate) throw Object.assign(new Error('unique'), { code: 'P2002' });
  const code = `GP-${1001 + partners.length}`;
  partners.push({ id: `p${partners.length + 1}`, code, status: 'NEW', ...data, phone: data.phone as string });
  return { code };
});
const isStaff = mock(async (id: string) => id === 'staff-1');
const service = createGrowthPartnerService({ db: db as never, createPartnerWithNextCode: createPartnerWithNextCode as never, isStaff });

const reg = { name: 'Asha Kumari', phone: '9876543210', city: 'Patna', category: 'Photographer', referralTypes: ['Venues'], consent: true };
const ref = { partnerPhone: '9876543210', partnerCode: 'GP-1001', type: 'VENUE', name: 'ABC Banquet', phone: '9123456789', city: 'Patna', consent: true };

beforeEach(() => {
  partners = [];
  referrals = [];
  raceOnCreate = false;
  for (const m of [createPartnerWithNextCode, db.partnerReferral.create, db.partnerReferral.update]) m.mockClear();
});

describe('registration', () => {
  test('a new partner gets their code and first name — nothing else', async () => {
    expect(await service.register(reg)).toEqual({ status: 'registered', code: 'GP-1001', firstName: 'Asha' });
    expect(partners[0]).toMatchObject({ phone: '9876543210', city: 'Patna', status: 'NEW' });
    expect(partners[0].consentAt).toBeInstanceOf(Date);
  });

  test('an already-registered mobile gets the same polite answer WITHOUT the code', async () => {
    await service.register(reg);
    const again = await service.register({ ...reg, name: 'Someone Else', phone: '+91 98765 43210' });
    expect(again).toEqual({ status: 'already-registered' });
    expect(JSON.stringify(again)).not.toContain('GP-');
    expect(partners).toHaveLength(1);
  });

  test('two submissions racing on the same mobile → the loser is told "already registered"', async () => {
    raceOnCreate = true;
    expect(await service.register(reg)).toEqual({ status: 'already-registered' });
  });

  test('invalid input is refused before anything is written', async () => {
    await expect(service.register({ ...reg, consent: false })).rejects.toBeInstanceOf(ValidationError);
    expect(createPartnerWithNextCode).not.toHaveBeenCalled();
  });
});

describe('referral submission', () => {
  beforeEach(async () => {
    await service.register(reg);
  });

  test('mobile + code match → referral stored with consent, answer carries nothing back', async () => {
    expect(await service.submitReferral({ ...ref, partnerCode: 'gp1001' })).toEqual({ status: 'received' });
    expect(referrals[0]).toMatchObject({ partnerId: 'p1', type: 'VENUE', name: 'ABC Banquet', phone: '9123456789', status: 'SUBMITTED' });
    expect(referrals[0].consentAt).toBeInstanceOf(Date);
  });

  test('wrong code, unknown mobile, or someone else\'s code → the same message, nothing stored', async () => {
    await service.register({ ...reg, phone: '9000000001', name: 'Ravi' }); // GP-1002
    const cases = [{ partnerCode: 'GP-1999' }, { partnerPhone: '9000000009' }, { partnerCode: 'GP-1002' }];
    for (const c of cases) {
      const err = await service.submitReferral({ ...ref, ...c }).catch((e: Error) => e);
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as Error).message).toBe(PARTNER_NOT_FOUND);
    }
    expect(referrals).toHaveLength(0);
  });

  test('a rejected or inactive partner cannot submit', async () => {
    partners[0].status = 'INACTIVE';
    await expect(service.submitReferral(ref)).rejects.toBeInstanceOf(ConflictError);
    expect(referrals).toHaveLength(0);
  });

  test('the referred person must have agreed to be contacted', async () => {
    await expect(service.submitReferral({ ...ref, consent: false })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('staff', () => {
  beforeEach(async () => {
    await service.register(reg);
    await service.submitReferral(ref);
  });

  test('partner status and notes', async () => {
    await service.updatePartner('p1', { status: 'APPROVED', staffNotes: 'Knows 10 banquets' });
    expect(partners[0]).toMatchObject({ status: 'APPROVED', staffNotes: 'Knows 10 banquets' });
    await expect(service.updatePartner('p1', { status: 'VIP' })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.updatePartner('nope', { status: 'APPROVED' })).rejects.toBeInstanceOf(NotFoundError);
  });

  test('referral progresses; assignment only to staff; payout only after completion', async () => {
    await service.updateReferral('r1', { status: 'CONTACTED', assignedToId: 'staff-1' });
    expect(referrals[0]).toMatchObject({ status: 'CONTACTED', assignedTo: { connect: { id: 'staff-1' } } });
    await expect(service.updateReferral('r1', { assignedToId: 'customer-9' })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.updateReferral('r1', { payoutStatus: 'DUE', payoutAmount: 2000 })).rejects.toBeInstanceOf(ValidationError);
    await service.updateReferral('r1', { status: 'COMPLETED' });
    await service.updateReferral('r1', { payoutStatus: 'DUE', payoutAmount: 2000 });
    await service.updateReferral('r1', { payoutStatus: 'PAID' });
    expect(referrals[0]).toMatchObject({ status: 'PAID', payoutStatus: 'PAID', payoutAmount: 2000 });
    expect(referrals[0].paidAt).toBeInstanceOf(Date);
  });

  test('unassigning works; unknown referral is not found', async () => {
    await service.updateReferral('r1', { assignedToId: null });
    expect(referrals[0].assignedTo).toEqual({ disconnect: true });
    await expect(service.updateReferral('nope', { status: 'VERIFIED' })).rejects.toBeInstanceOf(NotFoundError);
  });
});
