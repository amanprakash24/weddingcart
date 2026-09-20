/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// Every unique rule on quotations, hit for real, must come back as a sentence a person can act on — and carry the database's
// own rule name so a live failure can be traced. (Before, all of these read "Quotation already exists with this field".)

dbDescribe('quotation duplicate rules speak plainly (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let withPrismaErrors: typeof import('@/lib/errors').withPrismaErrors;
  let counter = 0;

  beforeAll(async () => {
    app = await loadApp();
    ({ withPrismaErrors } = await import('@/lib/errors'));
    fx = createFixtures(app);
    await fx.purge();
  });
  afterAll(async () => {
    if (fx) {
      // supersedes links must go before the purge deletes the quotations
      await app.prisma.quotation.updateMany({ where: { quotationNumber: { startsWith: 'QTN-DBERR-' } }, data: { supersedesId: null } });
      await app.prisma.quotation.deleteMany({ where: { quotationNumber: { startsWith: 'QTN-DBERR-' } } });
      await fx.purge();
    }
  });

  const number = () => `QTN-DBERR-${Date.now()}-${++counter}`;
  const make = (consultationId: string, over: { status?: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'SUPERSEDED'; quotationNumber?: string; supersedesId?: string } = {}) =>
    withPrismaErrors('Quotation', () =>
      app.prisma.quotation.create({
        data: {
          consultationId,
          quotationNumber: over.quotationNumber ?? number(),
          status: over.status ?? 'DRAFT',
          subtotal: 1000,
          total: 1000,
          ...(over.supersedesId ? { supersedesId: over.supersedesId } : {}),
        },
      })
    );
  const failure = (promise: Promise<unknown>) => promise.then(() => null, (e: Error & { constraint?: string | null }) => e);

  test('a second OPEN quotation on one lead → "already has an open quotation", rule named', async () => {
    const c = await fx.consultation();
    await make(c.id, { status: 'SENT' });
    const error = await failure(make(c.id, { status: 'DRAFT' }));
    expect(error?.name).toBe('DuplicateError');
    expect(error?.message).toBe('This lead already has an open quotation — send it, edit it or discard it first.');
    expect(error?.constraint).toBe('quotations_one_open_per_source_key');
  });

  test('a second ACCEPTED quotation on one lead', async () => {
    const c = await fx.consultation();
    await make(c.id, { status: 'ACCEPTED' });
    const error = await failure(make(c.id, { status: 'ACCEPTED' }));
    expect(error?.message).toBe('This lead already has an accepted quotation.');
    expect(error?.constraint).toBe('quotations_one_accepted_per_source_key');
  });

  test('two revisions of one quotation', async () => {
    const c = await fx.consultation();
    const original = await make(c.id, { status: 'SUPERSEDED' });
    await make(c.id, { status: 'SUPERSEDED', supersedesId: original.id });
    const error = await failure(make(c.id, { status: 'SUPERSEDED', supersedesId: original.id }));
    expect(error?.message).toBe('This quotation already has a revision — refresh the page to see it.');
    expect(error?.constraint).toBe('quotations_supersedesId_key');
  });

  test('a quotation number that is already taken', async () => {
    const a = await fx.consultation();
    const b = await fx.consultation();
    const taken = number();
    await make(a.id, { quotationNumber: taken });
    const error = await failure(make(b.id, { quotationNumber: taken }));
    expect(error?.message).toBe('Another quotation took that number at the same moment — please try again.');
    expect(error?.constraint).toBe('quotations_quotationNumber_key');
  });

  test('none of these ever says "this field" any more', async () => {
    const c = await fx.consultation();
    await make(c.id, { status: 'DRAFT' });
    const error = await failure(make(c.id, { status: 'DRAFT' }));
    expect(error?.message).not.toContain('this field');
  });
});
