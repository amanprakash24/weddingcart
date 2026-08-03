// node --env-file=.env.local scripts/seed-commission-rates.mjs
//
// Sprint 7.3 — seeds the CommissionRate config vendor payouts are computed
// against: 10% global default, 12% for Venues and Photo & Video. This is
// real, ongoing business config (not disposable test/migration data) — keep
// this script permanently, safely re-runnable on any environment.
//
// Uses the raw `pg` driver, not the generated Prisma client — plain Node
// can't resolve the client's extensionless internal TS imports without a
// bundler (see scripts/migrate-to-postgres.mjs's header for the same note).
//
// Idempotency: commission_rates has no unique constraint on categoryId (by
// design — rate changes are new rows via effectiveFrom, not edits), so
// idempotency here means "insert only if no row exists yet for this
// categoryId" rather than an ON CONFLICT upsert.

import pg from 'pg';
import crypto from 'crypto';

const RATES = [
  { categoryName: null, rate: 10.0, label: 'Global default' },
  { categoryName: 'Venues', rate: 12.0, label: 'Venues' },
  { categoryName: 'Photo & Video', rate: 12.0, label: 'Photo & Video' },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL must be set (run with --env-file=.env.local)');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
  await client.connect();

  for (const { categoryName, rate, label } of RATES) {
    let categoryId = null;
    if (categoryName) {
      const res = await client.query('SELECT id FROM categories WHERE name = $1', [categoryName]);
      if (res.rows.length === 0) {
        console.error(`Category "${categoryName}" not found — skipping ${label}`);
        continue;
      }
      categoryId = res.rows[0].id;
    }

    const insertResult = await client.query(
      `INSERT INTO commission_rates (id, "categoryId", rate, "effectiveFrom", "createdAt")
       SELECT $1, $2, $3, now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM commission_rates WHERE "categoryId" IS NOT DISTINCT FROM $2)
       RETURNING id`,
      [crypto.randomUUID(), categoryId, rate]
    );

    if (insertResult.rows.length > 0) {
      console.log(`Inserted: ${label} @ ${rate}%`);
    } else {
      console.log(`Skipped (already seeded): ${label}`);
    }
  }

  await client.end();
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
