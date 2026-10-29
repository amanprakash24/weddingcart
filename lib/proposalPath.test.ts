/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { isProposalPath } from './proposalPath';

describe('isProposalPath', () => {
  test('matches the proposal pages only', () => {
    expect(isProposalPath('/proposal')).toBe(true);
    expect(isProposalPath(`/proposal/${'x'.repeat(43)}`)).toBe(true);
    for (const p of ['/', '/proposals', '/proposal-ideas', '/venues/patna', '/admin', null, undefined]) expect(isProposalPath(p)).toBe(false);
  });
});

describe('isCouplePromptPath', () => {
  test('the consultation popup is for couples: public pages yes; team, Vendor OS, a proposal and sign-up forms no', async () => {
    const { isCouplePromptPath } = await import('./proposalPath');
    for (const p of ['/', '/venues/patna', '/vendors', '/vendors/swayamvar-hall-patna', '/plan', '/cities/patna/venue', '/administration-tips']) expect(isCouplePromptPath(p)).toBe(true);
    for (const p of ['/admin', '/admin/crm', '/vendor', '/vendor/enquiries', '/vendor/login', '/workspace', `/proposal/${'x'.repeat(43)}`, '/growth-partner', '/vendor-onboarding', null, undefined]) expect(isCouplePromptPath(p)).toBe(false);
  });
});

describe('isVendorOsPath', () => {
  test('Vendor OS only — never the public vendor pages or onboarding', async () => {
    const { isVendorOsPath } = await import('./proposalPath');
    for (const p of ['/vendor', '/vendor/enquiries', '/vendor/proposals/q1', '/vendor/login', '/my-wedding', '/customer/login']) expect(isVendorOsPath(p)).toBe(true);
    for (const p of ['/vendors', '/vendors/swayamvar-hall-patna', '/vendor-onboarding', '/', null, undefined]) expect(isVendorOsPath(p)).toBe(false);
  });
});
