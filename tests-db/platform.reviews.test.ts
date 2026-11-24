/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';

// Reviews of Shaadi Shopping (24 Nov 2026) on a real database: nothing is public until staff publish it, and the public view never
// carries the mobile, the wedding ID or the full name.
dbDescribe('Reviews of Shaadi Shopping (real database)', () => {
  let app: App;
  let svc: typeof import('@/services/platformReview.service').platformReviewService;
  const ids: string[] = [];
  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;

  beforeAll(async () => {
    app = await loadApp();
    svc = (await import('@/services/platformReview.service')).platformReviewService;
  });
  afterAll(async () => {
    if (app && ids.length) await app.prisma.platformReview.deleteMany({ where: { id: { in: ids } } });
  });

  test('a new review waits; publishing shows only first name + initial, stars and words', async () => {
    const { id } = await svc.submit({ authorName: 'DBTEST Pratik Anand', rating: 5, comment: 'DBTEST lovely team', phone: '9876543210', weddingNumber: 'WED-2026-0002' });
    ids.push(id);
    const row = await app.prisma.platformReview.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: 'PENDING', phone: '9876543210', weddingNumber: 'WED-2026-0002' });
    expect((await svc.published(500)).reviews.some((r) => r.id === id)).toBe(false);

    await svc.moderate(id, 'PUBLISHED', null);
    const shown = (await svc.published(500)).reviews.find((r) => r.id === id);
    expect(shown).toMatchObject({ name: 'DBTEST P.', rating: 5, comment: 'DBTEST lovely team' });
    expect(JSON.stringify(shown)).not.toContain('9876543210');
    expect(JSON.stringify(shown)).not.toContain('WED-2026-0002');
    expect(JSON.stringify(shown)).not.toContain('Anand');

    await svc.moderate(id, 'HIDDEN', null);
    expect((await svc.published(500)).reviews.some((r) => r.id === id)).toBe(false);
    expect(await app.prisma.platformReview.count({ where: { id } })).toBe(1); // hidden, never deleted
  });

  test('bad input is refused and staff see every status', async () => {
    expect((await errorOf(svc.submit({ authorName: 'X', rating: 5 })))?.name).toBe('ValidationError');
    expect((await errorOf(svc.submit({ authorName: 'DBTEST Riya', rating: 9 })))?.name).toBe('ValidationError');
    expect((await errorOf(svc.moderate('00000000-0000-0000-0000-000000000000', 'PUBLISHED', null)))?.name).toBe('NotFoundError');
    const { id } = await svc.submit({ authorName: 'DBTEST Riya', rating: 4 });
    ids.push(id);
    const admin = await svc.forAdmin('PENDING');
    expect(admin.reviews.some((r) => r.id === id)).toBe(true);
    expect(admin.counts.PENDING).toBeGreaterThanOrEqual(1);
  });
});
