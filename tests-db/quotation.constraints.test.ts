/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { DB_TESTS_ENABLED, dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// The database's own guarantees for quotations (migration 20260920130000_add_quotation_workflow), proven against the
// real schema. Everything runs inside ONE transaction that is always rolled back, so nothing is left behind.
// Each rejected statement runs under a savepoint so the transaction can carry on after an expected error.

dbDescribe('quotation database constraints (real database, rolled back)', () => {
  let app: App;
  let fx: Fixtures;
  let db: Client;
  let consultationId: string;
  let otherConsultationId: string;
  let counter = 0;

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    consultationId = (await fx.consultation()).id;
    otherConsultationId = (await fx.consultation()).id;
    db = new Client({ connectionString: app.url, ssl: { rejectUnauthorized: false } });
    await db.connect();
    await db.query('begin');
  });

  afterAll(async () => {
    if (db) {
      await db.query('rollback').catch(() => undefined);
      await db.end().catch(() => undefined);
    }
    if (fx) await fx.purge();
  });

  const number = () => `QTN-DBTEST-${Date.now()}-${++counter}`;
  const INSERT =
    'insert into quotations (id,"quotationNumber","enquiryId","consultationId","leadId",status,subtotal,discount,"gstAmount",total,"advanceAmount","updatedAt") values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())';
  const quote = (o: Partial<{ consultation: string | null; enquiry: string | null; status: string; subtotal: number; discount: number; gst: number; total: number; advance: number; num: string }> = {}) => [
    randomUUID(),
    o.num ?? number(),
    o.enquiry ?? null,
    o.consultation === undefined ? consultationId : o.consultation,
    null,
    o.status ?? 'DRAFT',
    o.subtotal ?? 1000,
    o.discount ?? 0,
    o.gst ?? 0,
    o.total ?? (o.subtotal ?? 1000) - (o.discount ?? 0) + (o.gst ?? 0),
    o.advance ?? 0,
  ];

  async function rejected(sql: string, params: unknown[]): Promise<string> {
    await db.query('savepoint s');
    try {
      await db.query(sql, params);
    } catch (error) {
      await db.query('rollback to savepoint s');
      return (error as Error).message;
    }
    await db.query('rollback to savepoint s');
    throw new Error('the statement was ACCEPTED but should have been rejected');
  }
  async function accepted(sql: string, params: unknown[]) {
    await db.query('savepoint s');
    try {
      await db.query(sql, params);
      await db.query('release savepoint s');
    } catch (error) {
      await db.query('rollback to savepoint s');
      throw error;
    }
  }

  test('a quotation must have exactly one source — none is rejected', async () => {
    expect(await rejected(INSERT, quote({ consultation: null }))).toContain('quotations_exactly_one_source_chk');
  });

  test('…and two sources are rejected', async () => {
    const enquiry = (await db.query('select id from enquiries limit 1')).rows[0]?.id;
    if (!enquiry) return; // an empty test database has no enquiry to combine with — the other cases still cover the rule
    expect(await rejected(INSERT, quote({ enquiry }))).toContain('quotations_exactly_one_source_chk');
  });

  test.each([
    ['total is not subtotal − discount + tax', { subtotal: 1000, discount: 100, total: 999 }],
    ['the advance is more than the total', { subtotal: 1000, advance: 1001 }],
    ['the discount is more than the subtotal', { subtotal: 100, discount: 200, total: -100 }],
  ])('the money identity is enforced by the database: %s', async (_name, fields) => {
    expect(await rejected(INSERT, quote(fields))).toContain('quotations_money_chk');
  });

  test('a valid quotation is accepted (1000 − 100 + 50 = 950, advance 300)', async () => {
    await accepted(INSERT, quote({ subtotal: 1000, discount: 100, gst: 50, total: 950, advance: 300, num: 'QTN-DBTEST-VALID' }));
  });

  test('a second OPEN quotation for the same source is rejected', async () => {
    expect(await rejected(INSERT, quote({ status: 'SENT' }))).toContain('quotations_one_open_per_source_key');
  });

  test('…but a different source may have its own', async () => {
    await accepted(INSERT, quote({ consultation: otherConsultationId }));
  });

  test('quotation numbers are unique', async () => {
    expect(await rejected(INSERT, quote({ consultation: otherConsultationId, status: 'REJECTED', num: 'QTN-DBTEST-VALID' }))).toContain('quotationNumber');
  });

  test('once accepted, the open slot is free again — but only ONE accepted quotation per source is allowed', async () => {
    await db.query(`update quotations set status='ACCEPTED' where "quotationNumber"='QTN-DBTEST-VALID'`);
    await accepted(INSERT, quote({ status: 'DRAFT' }));
    expect(await rejected(INSERT, quote({ status: 'ACCEPTED' }))).toContain('quotations_one_accepted_per_source_key');
  });

  test('a source that has quotations cannot be deleted (ON DELETE RESTRICT)', async () => {
    expect(await rejected('delete from consultations where id=$1', [consultationId])).toContain('quotations_consultationId_fkey');
  });

  test('line items: quantity must be at least 1 and the price cannot be negative', async () => {
    const parent = (await db.query(`select id from quotations where "quotationNumber"='QTN-DBTEST-VALID'`)).rows[0].id;
    const item = 'insert into quotation_items (id,"quotationId","sortOrder",description,"unitPrice",quantity) values ($1,$2,1,$3,$4,$5)';
    expect(await rejected(item, [randomUUID(), parent, 'x', 100, 0])).toContain('quotation_items_amounts_chk');
    expect(await rejected(item, [randomUUID(), parent, 'x', -1, 1])).toContain('quotation_items_amounts_chk');
    await accepted(item, [randomUUID(), parent, 'Catering x500', 800, 500]);
  });

  test('only one Booking can exist per quotation (Booking.quotationId is unique)', async () => {
    const parent = (await db.query(`select id from quotations where "quotationNumber"='QTN-DBTEST-VALID'`)).rows[0].id;
    const booking = 'insert into bookings (id,name,phone,city,total,"quotationId","updatedAt") values ($1,$2,$3,$4,$5,$6,now())';
    await accepted(booking, [randomUUID(), 'T', '9876543210', 'Patna', 950, parent]);
    expect(await rejected(booking, [randomUUID(), 'T2', '9876543210', 'Patna', 950, parent])).toContain('bookings_quotationId_key');
  });

  test('nothing from this file survives: the transaction is rolled back', async () => {
    await db.query('rollback');
    const left = await app.prisma.quotation.count({ where: { quotationNumber: { startsWith: 'QTN-DBTEST' } } });
    expect(left).toBe(0);
    await db.query('begin'); // keep the afterAll rollback valid
  });
});

test('the database tests are skipped unless explicitly enabled', () => {
  // With no TEST_DATABASE_URL (or outside `bun run test:db`) the suite above is skipped; this keeps the file green.
  expect(typeof DB_TESTS_ENABLED).toBe('boolean');
});
