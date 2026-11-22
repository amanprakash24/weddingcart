/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { Role } from '@/lib/auth/roles';
import {
  canAssignWork,
  canSeeCommission,
  canSeeVendorMoney,
  hasMoneyAccess,
  sourceMoneyAccess,
  weddingMoneyAccess,
  type Viewer,
} from './moneyAccess';

const founder: Viewer = { userId: 'f', roles: [Role.SUPER_ADMIN] };
const rep: Viewer = { userId: 'rep', roles: [Role.SALES] };
const ops: Viewer = { userId: 'ops', roles: [Role.OPERATIONS] };
const other: Viewer = { userId: 'other', roles: [Role.SALES] };

describe('weddingMoneyAccess', () => {
  const wedding = { coordinatorId: 'ops', sourceAssignedToId: 'rep' };

  test('founder: full on any wedding, even unassigned', () => {
    expect(weddingMoneyAccess(founder, wedding)).toBe('full');
    expect(weddingMoneyAccess(founder, { coordinatorId: null, sourceAssignedToId: null })).toBe('full');
  });
  test('the coordinator: full', () => expect(weddingMoneyAccess(ops, wedding)).toBe('full'));
  test('the rep who owned the lead: read-only', () => expect(weddingMoneyAccess(rep, wedding)).toBe('read'));
  test('anyone else on the team: none', () => expect(weddingMoneyAccess(other, wedding)).toBe('none'));
  test('nobody assigned: none for the team', () => {
    expect(weddingMoneyAccess(ops, { coordinatorId: null, sourceAssignedToId: null })).toBe('none');
  });
  test('a missing user id never matches a missing assignment', () => {
    expect(weddingMoneyAccess({ userId: null, roles: [Role.SALES] }, { coordinatorId: null, sourceAssignedToId: null })).toBe('none');
    expect(weddingMoneyAccess({ userId: undefined, roles: [Role.OPERATIONS] }, { coordinatorId: null, sourceAssignedToId: null })).toBe('none');
  });
  test('vendor and customer roles: none', () => {
    expect(weddingMoneyAccess({ userId: 'ops', roles: [Role.VENDOR] }, { coordinatorId: 'x', sourceAssignedToId: null })).toBe('none');
  });
});

describe('sourceMoneyAccess', () => {
  test('before booking: the assigned rep has full access, others none, founder full', () => {
    const lead = { assignedToId: 'rep', wedding: null };
    expect(sourceMoneyAccess(rep, lead)).toBe('full');
    expect(sourceMoneyAccess(other, lead)).toBe('none');
    expect(sourceMoneyAccess(ops, lead)).toBe('none');
    expect(sourceMoneyAccess(founder, lead)).toBe('full');
  });
  test('unassigned lead: founder only', () => {
    const lead = { assignedToId: null, wedding: null };
    expect(sourceMoneyAccess(rep, lead)).toBe('none');
    expect(sourceMoneyAccess(founder, lead)).toBe('full');
  });
  test('after booking: the rep drops to read-only; the coordinator gets full', () => {
    const lead = { assignedToId: 'rep', wedding: { coordinatorId: 'ops' } };
    expect(sourceMoneyAccess(rep, lead)).toBe('read');
    expect(sourceMoneyAccess(ops, lead)).toBe('full');
    expect(sourceMoneyAccess(other, lead)).toBe('none');
  });
});

describe('hasMoneyAccess', () => {
  test.each([
    ['full', 'full', true], ['full', 'read', true], ['read', 'read', true],
    ['read', 'full', false], ['none', 'read', false], ['none', 'full', false],
  ] as const)('%s satisfies %s → %s', (access, needed, ok) => expect(hasMoneyAccess(access, needed)).toBe(ok));
});

describe('vendor money, commission and assigning', () => {
  test('vendor prices and payouts: full access only (the coordinator), not the read-only rep', () => {
    expect(canSeeVendorMoney('full')).toBe(true);
    expect(canSeeVendorMoney('read')).toBe(false);
    expect(canSeeVendorMoney('none')).toBe(false);
  });
  test('commission: founder only, not even the coordinator', () => {
    expect(canSeeCommission(founder)).toBe(true);
    expect(canSeeCommission(ops)).toBe(false);
  });
  test('assigning leads and coordinators: founder only', () => {
    expect(canAssignWork(founder)).toBe(true);
    expect(canAssignWork(rep)).toBe(false);
    expect(canAssignWork(ops)).toBe(false);
  });
});
