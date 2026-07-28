// node --env-file=.env.local scripts/validate-post-migration.mjs
//
// Post-migration validator: compares MongoDB (source) against the migrated
// PostgreSQL data (destination) — counts, then a per-record checksum matched
// via `legacyMongoId` (see prisma/schema.prisma). Read-only on both sides.
//
// NOT YET RUNNABLE as of 2026-07-19: no live Postgres instance is provisioned
// (DATABASE_URL in .env.local is a placeholder) and no migration script has
// run yet. This is Milestone 3 tooling, written and ready ahead of that work.
//
// Uses the raw `pg` driver rather than the generated Prisma client — Node
// cannot resolve the generated client's extensionless internal TS imports
// without a bundler (verified: fails with MODULE_NOT_FOUND on plain `node`),
// and every other script in this repo already talks to its database directly
// rather than through an ORM, so this stays consistent with that convention.

import { MongoClient } from 'mongodb';
import pg from 'pg';
import { createHash } from 'crypto';

const mongoUri = process.env.MONGODB_URI;
const pgUrl = process.env.DATABASE_URL;
if (!mongoUri || !pgUrl) {
  console.error('MONGODB_URI and DATABASE_URL must both be set');
  process.exit(1);
}

const mongo = new MongoClient(mongoUri);
// Explicit timeout — verified during development that an unreachable Postgres
// (e.g. the placeholder DATABASE_URL before a real instance is provisioned)
// hangs on the OS-default TCP timeout otherwise, rather than failing fast.
const pgClient = new pg.Client({ connectionString: pgUrl, connectionTimeoutMillis: 5000 });

try {
  await mongo.connect();
  await pgClient.connect();
} catch (err) {
  console.error(`Could not connect to both databases: ${err.message}`);
  console.error('Is DATABASE_URL pointed at a real, reachable Postgres instance?');
  process.exit(1);
}
const db = mongo.db();

const issues = []; // { level: 'MISMATCH' | 'MISSING' | 'COUNT', table: string, detail: string }

function hash(obj) {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}
function sortedArr(a) {
  return [...(a ?? [])].sort();
}

// Each entry: Mongo collection -> Postgres table, plus canonical-shape
// builders for both sides. Canonical objects must have the same keys so a
// hash mismatch means a real value difference, not a shape difference.
const tables = [
  {
    name: 'Category',
    mongoCollection: 'categories',
    pgTable: 'categories',
    mongoCanonical: (d) => ({
      slug: d.id,
      name: d.name,
      icon: d.icon,
      description: d.description,
      image: d.image,
      isSpecial: !!d.isSpecial,
    }),
    pgCanonical: (r) => ({
      slug: r.slug,
      name: r.name,
      icon: r.icon,
      description: r.description,
      image: r.image,
      isSpecial: r.isSpecial,
    }),
  },
  {
    name: 'Vendor',
    mongoCollection: 'vendors',
    pgTable: 'vendors',
    mongoCanonical: (d) => ({
      slug: d.id,
      name: d.name,
      city: d.city,
      priceMin: d.priceMin,
      priceMax: d.priceMax,
      image: d.image,
      description: d.description,
      features: sortedArr(d.features),
      isFeatured: !!d.isFeatured,
    }),
    pgCanonical: (r) => ({
      slug: r.slug,
      name: r.name,
      city: r.city,
      priceMin: r.priceMin,
      priceMax: r.priceMax,
      image: r.image,
      description: r.description,
      features: sortedArr(r.features),
      isFeatured: r.isFeatured,
    }),
  },
  {
    name: 'VendorApplication',
    mongoCollection: 'vendorapplications',
    pgTable: 'vendor_applications',
    mongoCanonical: (d) => ({
      businessName: d.businessName,
      ownerPhone: d.ownerPhone,
      ownerEmail: d.ownerEmail,
      city: d.city,
      status: d.status?.toUpperCase(),
    }),
    pgCanonical: (r) => ({
      businessName: r.businessName,
      ownerPhone: r.ownerPhone,
      ownerEmail: r.ownerEmail,
      city: r.city,
      status: r.status,
    }),
  },
  {
    name: 'Lead',
    mongoCollection: 'leads',
    pgTable: 'leads',
    mongoCanonical: (d) => ({ phone: d.phone, whatsapp: !!d.whatsapp, source: d.source }),
    pgCanonical: (r) => ({ phone: r.phone, whatsapp: r.whatsapp, source: r.source }),
  },
  {
    name: 'Enquiry',
    mongoCollection: 'enquiries',
    pgTable: 'enquiries',
    mongoCanonical: (d) => ({
      vendorName: d.vendorName,
      name: d.name,
      phone: d.phone,
      city: d.city,
      eventDate: d.eventDate,
      status: d.status?.toUpperCase(),
    }),
    pgCanonical: (r) => ({
      vendorName: r.vendorName,
      name: r.name,
      phone: r.phone,
      city: r.city,
      eventDate: r.eventDate,
      status: r.status,
    }),
  },
  {
    name: 'Consultation',
    mongoCollection: 'consultations',
    pgTable: 'consultations',
    mongoCanonical: (d) => ({
      name: d.name,
      phone: d.phone,
      weddingDate: d.weddingDate,
      days: d.days,
      guestCount: d.guestCount,
      status: d.status?.toUpperCase(),
    }),
    pgCanonical: (r) => ({
      name: r.name,
      phone: r.phone,
      weddingDate: r.weddingDate,
      days: r.days,
      guestCount: r.guestCount,
      status: r.status,
    }),
  },
  {
    name: 'Booking',
    mongoCollection: 'bookings',
    pgTable: 'bookings',
    mongoCanonical: (d) => ({
      name: d.name,
      phone: d.phone,
      city: d.city,
      total: d.total,
      status: d.status?.toUpperCase(),
    }),
    pgCanonical: (r) => ({
      name: r.name,
      phone: r.phone,
      city: r.city,
      total: r.total,
      status: r.status,
    }),
  },
  {
    name: 'Invoice',
    mongoCollection: 'invoices',
    pgTable: 'invoices',
    mongoCanonical: (d) => ({
      invoiceNumber: d.invoiceNumber,
      clientName: d.clientName,
      subtotal: d.subtotal,
      total: d.total,
      status: d.status?.toUpperCase(),
    }),
    pgCanonical: (r) => ({
      invoiceNumber: r.invoiceNumber,
      clientName: r.clientName,
      subtotal: r.subtotal,
      total: r.total,
      status: r.status,
    }),
  },
  {
    name: 'Blog',
    mongoCollection: 'blogs',
    pgTable: 'blogs',
    mongoCanonical: (d) => ({
      title: d.title,
      slug: d.slug,
      status: d.status?.toUpperCase(),
      tags: sortedArr(d.tags),
    }),
    pgCanonical: (r) => ({
      title: r.title,
      slug: r.slug,
      status: r.status,
      tags: sortedArr(r.tags),
    }),
  },
];

for (const t of tables) {
  const mongoDocs = await db.collection(t.mongoCollection).find({}).toArray();
  const { rows: pgRows } = await pgClient.query(
    `SELECT * FROM ${t.pgTable} WHERE "legacyMongoId" IS NOT NULL`
  );
  const pgByLegacyId = new Map(pgRows.map((r) => [r.legacyMongoId, r]));

  if (mongoDocs.length !== pgRows.length) {
    issues.push({
      level: 'COUNT',
      table: t.name,
      detail: `Mongo has ${mongoDocs.length}, Postgres has ${pgRows.length}`,
    });
  }

  let checked = 0;
  let mismatched = 0;
  for (const doc of mongoDocs) {
    const legacyId = doc._id.toString();
    const pgRow = pgByLegacyId.get(legacyId);
    if (!pgRow) {
      issues.push({ level: 'MISSING', table: t.name, detail: `Mongo _id ${legacyId} has no matching Postgres row` });
      continue;
    }
    checked++;
    const mongoHash = hash(t.mongoCanonical(doc));
    const pgHash = hash(t.pgCanonical(pgRow));
    if (mongoHash !== pgHash) {
      mismatched++;
      issues.push({
        level: 'MISMATCH',
        table: t.name,
        detail: `Mongo _id ${legacyId}: field checksum differs from Postgres row ${pgRow.id}`,
      });
    }
  }

  console.log(`${t.name}: ${mongoDocs.length} source, ${pgRows.length} destination, ${checked} checksummed, ${mismatched} mismatched`);
}

console.log('');
console.log(`Total issues: ${issues.length}`);
if (issues.length) {
  console.log('');
  for (const i of issues) console.log(`   [${i.level}] ${i.table}: ${i.detail}`);
}
console.log('');
console.log(issues.length === 0 ? 'POST-MIGRATION VALIDATION PASSED ✅' : 'POST-MIGRATION VALIDATION FAILED ❌ — see docs/rollback-checklist.md');
console.log('');
console.log(
  'NOTE: this covers top-level tables only. VendorPackage/VendorFaq/BookingItem/' +
    'InvoiceItem (subdocument-derived tables — see Batch 4/6/7 in ' +
    'docs/migration-test-plan.md) are NOT yet checksummed here, only via their ' +
    "parent's presence. Extend this script with flattened-array comparisons for " +
    'those before treating a passing run as full coverage.'
);

await mongo.close();
await pgClient.end();
process.exit(issues.length === 0 ? 0 : 1);
