/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runInScope } from '@/lib/ownership/scope';
import { dbDescribe, inDays, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// CRM "Share quotation on WhatsApp" (20 Nov 2026) against the real database: DRAFT → READY_TO_SHARE (link made) → SENT only when
// staff confirm; "not sent" goes back to DRAFT and kills the link; a second click is refused; the client can open, ask for
// changes and accept a READY_TO_SHARE quote; every step is in the history.

const errorOf = (promise: Promise<unknown>) => promise.then(() => null, (e: Error) => e);

dbDescribe('CRM quotation sharing (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let proposalService: typeof import('@/services/proposal.service').proposalService;
  let scopeForProposalToken: typeof import('@/lib/quotation/proposalEntry').scopeForProposalToken;
  const onLink = async <T>(token: string, fn: () => Promise<T>) => runInScope(await scopeForProposalToken(token), fn);

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    proposalService = (await import('@/services/proposal.service')).proposalService;
    scopeForProposalToken = (await import('@/lib/quotation/proposalEntry')).scopeForProposalToken;
  });
  afterAll(async () => {
    if (fx) await fx.purge();
  });

  const draftFor = async () => {
    const c = await fx.consultation();
    const q = await app.quotationService.create('CONSULTATION', c.id, { items: [fx.line('Venue', 100000)], validUntil: inDays(10) }, null);
    return { c, q };
  };
  const statusOf = async (id: string) => (await app.prisma.quotation.findUniqueOrThrow({ where: { id } })).status;
  const history = async (consultationId: string) =>
    (await app.prisma.activityLog.findMany({ where: { consultationId }, orderBy: { createdAt: 'asc' }, select: { summary: true } })).map((a) => a.summary);

  test('share → READY_TO_SHARE with a working link; not SENT, no sentAt, stage unchanged; a second share is refused', async () => {
    const { c, q } = await draftFor();
    const { quotation, token } = await app.quotationService.prepareShare(q.id, null);
    expect(quotation.status).toBe('READY_TO_SHARE');
    expect(quotation.sentAt).toBeNull();
    expect(quotation.hasCustomerLink).toBe(true);
    expect(token.length).toBeGreaterThan(20);
    expect((await app.prisma.consultation.findUniqueOrThrow({ where: { id: c.id } })).pipelineStage).not.toBe('QUOTATION_SENT');

    // The client can open it before staff confirm.
    const view = await onLink(token, () => proposalService.view(token, { trackView: false }));
    expect(view?.state).toBe('OPEN');

    // Duplicate click / second tab: refused, and the first link keeps working.
    const again = await errorOf(app.quotationService.prepareShare(q.id, null));
    expect(again?.name).toBe('ConflictError');
    expect((await onLink(token, () => proposalService.view(token, { trackView: false })))?.state).toBe('OPEN');

    // Locked while ready: no edits.
    const edit = await errorOf(app.quotationService.update(q.id, { items: [fx.line('Venue', 1)], validUntil: inDays(10) }));
    expect(edit?.message).toContain('back to draft');
  });

  test('two shares at the same moment: exactly one wins', async () => {
    const { q } = await draftFor();
    const results = await Promise.allSettled([app.quotationService.prepareShare(q.id, null), app.quotationService.prepareShare(q.id, null)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await statusOf(q.id)).toBe('READY_TO_SHARE');
  });

  test('"Yes, it\'s sent" → SENT with sentAt and the stage moves; the link made at share time still works', async () => {
    const { c, q } = await draftFor();
    const { token } = await app.quotationService.prepareShare(q.id, null);
    const sent = await app.quotationService.send(q.id, null);
    expect(sent.quotation.status).toBe('SENT');
    expect(sent.quotation.sentAt).not.toBeNull();
    expect((await app.prisma.consultation.findUniqueOrThrow({ where: { id: c.id } })).pipelineStage).toBe('QUOTATION_SENT');
    expect((await onLink(token, () => proposalService.view(token, { trackView: false })))?.state).toBe('OPEN');
    const log = await history(c.id);
    expect(log.some((s) => s.includes('ready to share'))).toBe(true);
    expect(log.some((s) => s.includes('sent (confirmed by staff)'))).toBe(true);
  });

  test('"Not sent" → back to DRAFT, never SENT; the link stops working; it can be shared again', async () => {
    const { c, q } = await draftFor();
    const { token } = await app.quotationService.prepareShare(q.id, null);
    const back = await app.quotationService.cancelShare(q.id, null);
    expect(back.status).toBe('DRAFT');
    expect(back.sentAt).toBeNull();
    expect(back.hasCustomerLink).toBe(false);
    const viewAfter = await onLink(token, () => proposalService.view(token, { trackView: false })).catch(() => null);
    expect(viewAfter).toBeNull();
    // Editable again, and shareable again with a new link.
    await app.quotationService.update(q.id, { items: [fx.line('Venue', 95000)], validUntil: inDays(10) });
    const second = await app.quotationService.prepareShare(q.id, null);
    expect(second.token).not.toBe(token);
    expect((await history(c.id)).some((s) => s.includes('not sent — back to draft'))).toBe(true);
    // Cancelling something that is not ready to share is refused.
    await app.quotationService.send(q.id, null);
    expect((await errorOf(app.quotationService.cancelShare(q.id, null)))?.name).toBe('ConflictError');
  });

  test('"Open WhatsApp again": a new link for a ready quote, the earlier one stops working, still not SENT', async () => {
    const { q } = await draftFor();
    const first = await app.quotationService.prepareShare(q.id, null);
    const second = await app.quotationService.issueCustomerLink(q.id, null);
    expect(await statusOf(q.id)).toBe('READY_TO_SHARE');
    expect(await onLink(first.token, () => proposalService.view(first.token, { trackView: false })).catch(() => null)).toBeNull();
    expect((await onLink(second.token, () => proposalService.view(second.token, { trackView: false })))?.state).toBe('OPEN');
  });

  test('the client asks for changes on a ready quote: recorded against it, status and prices untouched', async () => {
    const { c, q } = await draftFor();
    const { token } = await app.quotationService.prepareShare(q.id, null);
    await onLink(token, () => proposalService.requestChanges(token, 'Please add mehendi decor'));
    const row = await app.prisma.quotation.findUniqueOrThrow({ where: { id: q.id } });
    expect(row.status).toBe('READY_TO_SHARE');
    expect(row.total).toBe(q.total);
    expect(row.changesRequestNote).toContain('Please add mehendi decor');
    expect((await history(c.id)).length).toBeGreaterThan(0);
  });

  test('the client accepts a ready quote: ACCEPTED, sentAt filled, the history says it was before staff confirmed', async () => {
    const { c, q } = await draftFor();
    const { token } = await app.quotationService.prepareShare(q.id, null);
    const res = await onLink(token, () => proposalService.accept(token));
    expect(res.state).toBe('ACCEPTED');
    const row = await app.prisma.quotation.findUniqueOrThrow({ where: { id: q.id } });
    expect(row.status).toBe('ACCEPTED');
    expect(row.acceptedChannel).toBe('ONLINE');
    expect(row.sentAt).not.toBeNull();
    expect((await history(c.id)).some((s) => s.includes('before staff confirmed'))).toBe(true);
    // A second click on Accept is still success, nothing changes.
    expect((await onLink(token, () => proposalService.accept(token))).alreadyAccepted).toBe(true);
  });

  test('a ready quote counts as the open quote of its client (a second quote cannot be started); past its date it expires', async () => {
    const { c, q } = await draftFor();
    await app.quotationService.prepareShare(q.id, null);
    const second = await errorOf(app.quotationService.create('CONSULTATION', c.id, { items: [fx.line('Venue v2', 1)] }, null));
    expect(second?.message).toContain('open quotation');
    await app.prisma.quotation.update({ where: { id: q.id }, data: { validUntil: inDays(-1) } });
    expect((await app.quotationService.listForSource('CONSULTATION', c.id))[0].status).toBe('EXPIRED');
  });
});
