// Who may load the couple's proposal page, and what is written while deciding (docs/wedding-os/08-quotation.md §15.5).
//
// The link is 256 random bits (only its hash is stored), so the only abuse worth throttling is someone trying links
// that don't work. So only a FAILED lookup (malformed, unknown, revoked, superseded …) is recorded in the rate-limit
// table; opening a valid link records nothing (its only write is the one-time first view — decision D6). The check
// itself runs before the lookup, so an IP that has tried too many bad links is stopped before any lookup.
import type { CustomerProposal } from '@/lib/quotation/proposal';

export const PROPOSAL_MISS_LIMIT = { max: 30, windowMinutes: 15 } as const;

export interface ProposalViewGateDeps {
  isLimited: (identifier: string, options: { max: number; windowMinutes: number }) => Promise<boolean>;
  recordMiss: (identifier: string) => Promise<void>;
  view: (token: string, options: { trackView: boolean }) => Promise<CustomerProposal | null>;
}

export type ProposalViewResult = { kind: 'limited' } | { kind: 'invalid' } | { kind: 'ok'; proposal: CustomerProposal };

export async function gateProposalView(
  input: { ip: string; token: string; isPreviewBot: boolean },
  deps: ProposalViewGateDeps
): Promise<ProposalViewResult> {
  const identifier = `proposal-miss:${input.ip}`;
  if (await deps.isLimited(identifier, PROPOSAL_MISS_LIMIT)) return { kind: 'limited' };
  const proposal = await deps.view(input.token, { trackView: !input.isPreviewBot });
  if (!proposal) {
    await deps.recordMiss(identifier);
    return { kind: 'invalid' };
  }
  return { kind: 'ok', proposal };
}
