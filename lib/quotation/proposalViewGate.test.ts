/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { gateProposalView, PROPOSAL_MISS_LIMIT } from './proposalViewGate';
import type { CustomerProposal } from './proposal';

// All dependencies are fakes — nothing touches a database.
const proposal = { state: 'OPEN' } as unknown as CustomerProposal;
let limited = false;
let found: CustomerProposal | null = proposal;
const isLimited = mock(async () => limited);
const recordMiss = mock(async () => {});
const view = mock(async () => found);
const deps = { isLimited, recordMiss, view };
const input = { ip: '1.2.3.4', token: 'T'.repeat(43), isPreviewBot: false };

beforeEach(() => {
  limited = false;
  found = proposal;
  for (const m of [isLimited, recordMiss, view]) m.mockClear();
});

describe('gateProposalView — only failed lookups are recorded', () => {
  test('a valid link (open, expired or accepted) shows the proposal and records NO rate-limit row', async () => {
    expect(await gateProposalView(input, deps)).toEqual({ kind: 'ok', proposal });
    expect(recordMiss).not.toHaveBeenCalled();
    expect(isLimited).toHaveBeenCalledWith('proposal-miss:1.2.3.4', PROPOSAL_MISS_LIMIT); // the check still runs first
    expect(view).toHaveBeenCalledWith(input.token, { trackView: true });
  });

  test('a link that does not work records exactly one miss and shows the generic page', async () => {
    found = null;
    expect(await gateProposalView(input, deps)).toEqual({ kind: 'invalid' });
    expect(recordMiss).toHaveBeenCalledTimes(1);
    expect(recordMiss).toHaveBeenCalledWith('proposal-miss:1.2.3.4');
  });

  test('an IP over the limit is stopped before any lookup — nothing looked up, nothing recorded', async () => {
    limited = true;
    expect(await gateProposalView(input, deps)).toEqual({ kind: 'limited' });
    expect(view).not.toHaveBeenCalled();
    expect(recordMiss).not.toHaveBeenCalled();
  });

  test('a link-preview bot on a valid link: no first view tracked and nothing recorded', async () => {
    expect((await gateProposalView({ ...input, isPreviewBot: true }, deps)).kind).toBe('ok');
    expect(view).toHaveBeenCalledWith(input.token, { trackView: false });
    expect(recordMiss).not.toHaveBeenCalled();
  });

  test('same limit as before: 30 failed lookups per 15 minutes per IP', () => {
    expect(PROPOSAL_MISS_LIMIT).toEqual({ max: 30, windowMinutes: 15 });
  });
});
