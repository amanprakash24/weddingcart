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
