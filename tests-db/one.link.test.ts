/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runInScope } from '@/lib/ownership/scope';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';
import { COUPLE_SIGN_IN_TASK } from '@/lib/customer/weddingLink';

// One link per couple (22 Nov 2026), on a real database. The couple's ONE proposal link survives revisions (it shows the newest version
// that has been sent; while one is being drafted it says the proposal is being updated), a new link retires every older one, and once
// the booking becomes a wedding the same link leads into My Wedding — with a task for staff until the couple can sign in.
dbDescribe('One link per couple (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let proposal: typeof import('@/services/proposal.service').proposalService;
  let scopeFor: typeof import('@/lib/quotation/proposalEntry').scopeForProposalToken;
  let coupleLogin: typeof import('@/services/coupleLogin.service').coupleLoginService;
  let consultationId = '';
  let v1 = '';
  let v2 = '';
  let token = '';
  let staffId = '';
  const created: string[] = [];

  const onLink = async <T>(t: string, fn: () => Promise<T>) => runInScope(await scopeFor(t), fn);
  const viewOf = (t: string) => onLink(t, () => proposal.view(t, { trackView: false }));

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    proposal = (await import('@/services/proposal.service')).proposalService;
    scopeFor = (await import('@/lib/quotation/proposalEntry')).scopeForProposalToken;
    coupleLogin = (await import('@/services/coupleLogin.service')).coupleLoginService;
    staffId = (await app.prisma.user.findFirstOrThrow({ where: { roles: { some: { role: { in: ['SUPER_ADMIN', 'SALES', 'OPERATIONS'] } } } }, select: { id: true } })).id;
    const c = await fx.consultation({ name: 'DBTEST one link', weddingDate: '2027-02-14', guestCount: 150 });
    consultationId = c.id;
    v1 = (await fx.sentQuote(c.id, { items: [fx.line('Decoration', 120000, 1, undefined, 'Decorators')], advance: 10000 })).id;
    token = (await app.quotationService.issueCustomerLink(v1, staffId)).token;
  });
  afterAll(async () => {
    if (fx) await fx.purge();
    if (app && created.length) {
      await app.prisma.userRole.deleteMany({ where: { userId: { in: created } } });
      await app.prisma.user.deleteMany({ where: { id: { in: created } } });
    }
  });

  test('a revision keeps the couple’s link: while the new version is a draft the page says “being updated”', async () => {
    expect((await viewOf(token))?.number).toBeTruthy();
    v2 = (await app.quotationService.revise(v1, staffId)).id;
    expect(await viewOf(token)).toBeNull();
    expect(await onLink(token, () => proposal.beingUpdated(token))).toBe(true);
    // a draft is not on the link yet, so staff do not see it as linked
    const list = await app.quotationService.listForSource('CONSULTATION', consultationId);
    expect(list.find((q) => q.id === v2)).toMatchObject({ hasCustomerLink: false, linkOnEarlierVersion: false });
  });

  test('once the new version is sent, the SAME link shows it — and accepting accepts the new version', async () => {
    // staff give the new version its 'valid until' date (a revision starts without one), then send it
    await app.prisma.quotation.update({ where: { id: v2 }, data: { validUntil: new Date(Date.now() + 10 * 86_400_000) } });
    await app.quotationService.send(v2, staffId);
    const view = await viewOf(token);
    const v2Number = (await app.prisma.quotation.findUniqueOrThrow({ where: { id: v2 } })).quotationNumber;
    expect(view?.number).toBe(v2Number);
    expect(view?.state).toBe('OPEN');
    expect(await onLink(token, () => proposal.beingUpdated(token))).toBe(false);
    // staff see the couple's link reaching the new version — no second link needed
    const list = await app.quotationService.listForSource('CONSULTATION', consultationId);
    expect(list.find((q) => q.id === v2)).toMatchObject({ hasCustomerLink: true, linkOnEarlierVersion: true });
    const accepted = await onLink(token, () => proposal.accept(token));
    expect(accepted.state).toBe('ACCEPTED');
    expect((await app.prisma.quotation.findUniqueOrThrow({ where: { id: v2 } })).status).toBe('ACCEPTED');
    expect((await app.prisma.quotation.findUniqueOrThrow({ where: { id: v1 } })).status).toBe('SUPERSEDED');
  });

  test('booked → wedding: the link leads into My Wedding, staff get a task until the couple can sign in', async () => {
    const money = await app.agreement.loadAgreementMoney(v2);
    await app.commercialFlow.recordPaymentForQuotation(v2, { amount: money.confirmationAmount, method: 'UPI' }, staffId);
    const wedding = await app.prisma.wedding.findFirstOrThrow({ where: { sourceBooking: { quotationId: v2 } } });
    expect((await viewOf(token))?.myWedding).toEqual({ hasCoupleLogin: false });
    expect(await app.prisma.task.count({ where: { weddingId: wedding.id, title: COUPLE_SIGN_IN_TASK, status: 'PENDING' } })).toBe(1);

    const given = await coupleLogin.give(wedding.id, staffId);
    const userId = (await app.prisma.wedding.findUniqueOrThrow({ where: { id: wedding.id } })).customerId;
    if (userId) created.push(userId);
    expect(given).toBeTruthy();
    expect(await app.prisma.task.count({ where: { weddingId: wedding.id, title: COUPLE_SIGN_IN_TASK, status: 'DONE' } })).toBe(1);
    expect((await viewOf(token))?.myWedding).toEqual({ hasCoupleLogin: true });
  });

  test('a new link retires every older one; turning it off turns off the couple’s link wherever it lives', async () => {
    const fresh = (await app.quotationService.issueCustomerLink(v2, staffId)).token;
    expect(await viewOf(token)).toBeNull(); // the first link (on v1) no longer works
    expect(await onLink(token, () => proposal.beingUpdated(token))).toBe(false);
    expect((await viewOf(fresh))?.state).toBe('ACCEPTED');
    await app.quotationService.revokeCustomerLink(v2, staffId);
    expect(await viewOf(fresh)).toBeNull();
    expect(await app.prisma.quotation.count({ where: { consultationId, customerTokenHash: { not: null } } })).toBe(0);
  });
});
