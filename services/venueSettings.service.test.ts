/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { runInScope, PLATFORM_SCOPE, type Scope } from '@/lib/ownership/scope';

// A venue's own business settings (Phase C). Fakes only.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createVenueSettingsService } = await import('./venueSettings.service');

type Row = { id: string; kind: 'PLATFORM' | 'VENDOR'; name: string; numberPrefix: string | null; confirmationPercent: number | null; holdWindowDays: number | null; contactPhone: string | null; upiId: string | null; upiName: string | null };
let rows: Row[];
const update = mock(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => Object.assign(rows.find((r) => r.id === where.id)!, data));

const service = createVenueSettingsService({
  db: { business: { update: update as never } },
  business: (async (id: string) => rows.find((r) => r.id === id)!) as never,
  brand: (async (id: string) => ({ name: 'x', phone: rows.find((r) => r.id === id)?.contactPhone ?? '9000000001', isPlatform: false })) as never,
});

const owner: Scope = { kind: 'BUSINESS', businessId: 'venue-1', role: 'OWNER' };
const staff: Scope = { kind: 'BUSINESS', businessId: 'venue-1', role: 'STAFF' };
const outcome = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);

beforeEach(() => {
  update.mockClear();
  rows = [
    { id: 'venue-1', kind: 'VENDOR', name: 'Swayamvar Hall', numberPrefix: 'SWA', confirmationPercent: null, holdWindowDays: null, contactPhone: null, upiId: null, upiName: null },
    { id: 'venue-2', kind: 'VENDOR', name: 'Other Hall', numberPrefix: 'OTH', confirmationPercent: 40, holdWindowDays: 3, contactPhone: '9111111111', upiId: 'other@okaxis', upiName: 'Other Hall' },
    { id: 'shaadi-shopping', kind: 'PLATFORM', name: 'Shaadi Shopping', numberPrefix: null, confirmationPercent: null, holdWindowDays: null, contactPhone: null, upiId: null, upiName: null },
  ];
});

describe('venue settings', () => {
  test('a venue that set nothing sees blanks, the defaults, its code and the number its couples see', async () => {
    expect(await runInScope(owner, () => service.get())).toEqual({
      businessName: 'Swayamvar Hall', numberPrefix: 'SWA', contactPhone: null, confirmationPercent: null, holdWindowDays: null, upiId: null, upiName: null,
      shownPhone: '9000000001', defaults: { confirmationPercent: 25, holdWindowDays: 7 }, canEdit: true,
    });
  });

  test('the owner saves its own rule and number — on its own business only', async () => {
    const saved = await runInScope(owner, () => service.update({ contactPhone: '98765 00000', confirmationPercent: '30', holdWindowDays: '5' }));
    expect(saved).toMatchObject({ contactPhone: '9876500000', confirmationPercent: 30, holdWindowDays: 5, shownPhone: '9876500000' });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toEqual({ where: { id: 'venue-1' }, data: { contactPhone: '9876500000', confirmationPercent: 30, holdWindowDays: 5, upiId: null, upiName: null } });
    expect(rows[1]).toMatchObject({ confirmationPercent: 40, holdWindowDays: 3, contactPhone: '9111111111', upiId: 'other@okaxis' });
  });

  test('the owner saves where customers pay', async () => {
    expect(await runInScope(owner, () => service.update({ upiId: 'swayamvar@okhdfcbank', upiName: 'Swayamvar Hall' }))).toMatchObject({ upiId: 'swayamvar@okhdfcbank', upiName: 'Swayamvar Hall' });
    expect(await runInScope(owner, () => service.update({ upiId: 'not a upi id' }))).toEqual({ errors: { upiId: expect.any(String) } });
  });

  test('clearing a field goes back to the default', async () => {
    await runInScope(owner, () => service.update({ confirmationPercent: '30' }));
    expect(await runInScope(owner, () => service.update({ confirmationPercent: '' }))).toMatchObject({ confirmationPercent: null });
  });

  test('a wrong value is explained and nothing is saved', async () => {
    expect(await runInScope(owner, () => service.update({ confirmationPercent: '5' }))).toEqual({ errors: { confirmationPercent: expect.any(String) } });
    expect(update).not.toHaveBeenCalled();
  });

  test('a business id in the request is ignored — the scope decides', async () => {
    await runInScope(owner, () => service.update({ confirmationPercent: '30', businessId: 'venue-2', id: 'venue-2' } as never));
    expect(update.mock.calls[0][0].where).toEqual({ id: 'venue-1' });
    expect(Object.keys(update.mock.calls[0][0].data).sort()).toEqual(['confirmationPercent', 'contactPhone', 'holdWindowDays', 'upiId', 'upiName']);
  });

  test('staff see the settings but cannot change them', async () => {
    expect(await runInScope(staff, () => service.get())).toMatchObject({ canEdit: false });
    expect(await runInScope(staff, () => service.update({ confirmationPercent: '30' }))).toEqual({ forbidden: true });
    expect(update).not.toHaveBeenCalled();
  });

  test('Shaadi Shopping has no settings here — its rule lives in code', async () => {
    expect((await outcome(runInScope(PLATFORM_SCOPE, () => service.get())))?.name).toBe('NotFoundError');
    expect((await outcome(runInScope(PLATFORM_SCOPE, () => service.update({ confirmationPercent: '30' }))))?.name).toBe('NotFoundError');
    expect((await outcome(runInScope({ kind: 'SYSTEM', reason: 'test' }, () => service.get())))?.name).toBe('NotFoundError');
    expect(update).not.toHaveBeenCalled();
  });
});
