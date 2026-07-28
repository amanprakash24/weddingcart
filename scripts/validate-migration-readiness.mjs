// node --env-file=.env.local scripts/validate-migration-readiness.mjs
//
// Pre-migration data validator for the MongoDB -> PostgreSQL/Prisma cutover
// (see docs/postgres-migration-plan.md). Read-only — makes no writes.
//
// Exits 0 with "READY FOR MIGRATION" if there are no BLOCKING issues.
// Exits 1 if any blocking issue is found. WARNING-level issues never block —
// they're findings to review, not FK/constraint violations the migration
// script would choke on.

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db();

const issues = []; // { level: 'BLOCKING' | 'WARNING', check: string, detail: string }

function blocking(check, detail) {
  issues.push({ level: 'BLOCKING', check, detail });
}
function warning(check, detail) {
  issues.push({ level: 'WARNING', check, detail });
}

function findDuplicates(values) {
  const seen = new Map();
  const dupes = new Set();
  for (const v of values) {
    if (v === undefined || v === null || v === '') continue;
    if (seen.has(v)) dupes.add(v);
    seen.set(v, true);
  }
  return [...dupes];
}

function requireFields(doc, fields, label, idField = 'id') {
  const missing = fields.filter((f) => {
    const val = doc[f];
    return val === undefined || val === null || val === '';
  });
  if (missing.length) {
    blocking(
      'Missing required fields',
      `${label} ${doc[idField] ?? doc._id}: missing [${missing.join(', ')}]`
    );
  }
}

function looksLikeUrl(str) {
  return typeof str === 'string' && /^https?:\/\//.test(str);
}

// ---------- Load collections ----------

const [vendors, categories, blogs, bookings, enquiries, consultations, invoices, leads, applications] =
  await Promise.all([
    db.collection('vendors').find({}).toArray(),
    db.collection('categories').find({}).toArray(),
    db.collection('blogs').find({}).toArray(),
    db.collection('bookings').find({}).toArray(),
    db.collection('enquirys').find({}).toArray().then((r) => (r.length ? r : db.collection('enquiries').find({}).toArray())),
    db.collection('consultations').find({}).toArray(),
    db.collection('invoices').find({}).toArray(),
    db.collection('leads').find({}).toArray(),
    db.collection('vendorapplications').find({}).toArray(),
  ]);

const categoryIds = new Set(categories.map((c) => c.id));
const vendorIds = new Set(vendors.map((v) => v.id));

// ---------- Missing categories / broken references (BLOCKING — future FK) ----------

for (const v of vendors) {
  if (!categoryIds.has(v.category)) {
    blocking('Broken vendor->category reference', `Vendor "${v.name}" (${v.id}) has category "${v.category}" with no matching Category.id`);
  }
}
for (const e of enquiries) {
  if (!vendorIds.has(e.vendorId)) {
    blocking('Broken enquiry->vendor reference', `Enquiry ${e._id} has vendorId "${e.vendorId}" with no matching Vendor.id`);
  }
}
for (const a of applications) {
  if (a.vendorId && !vendorIds.has(a.vendorId)) {
    blocking('Broken vendorApplication->vendor reference', `VendorApplication ${a._id} has vendorId "${a.vendorId}" with no matching Vendor.id`);
  }
  if (!categoryIds.has(a.category)) {
    blocking('Broken vendorApplication->category reference', `VendorApplication "${a.businessName}" (${a._id}) has category "${a.category}" with no matching Category.id`);
  }
}
// Booking items denormalize vendor info and may legitimately reference a since-deleted
// vendor (historical order snapshot) — the Postgres BookingItem.vendorId FK is nullable
// specifically to tolerate this, so treat as a warning, not blocking.
for (const b of bookings) {
  for (const item of b.items ?? []) {
    if (item.vendorId && !vendorIds.has(item.vendorId)) {
      warning('Booking item references a since-removed vendor', `Booking ${b._id} item "${item.vendorName}" has vendorId "${item.vendorId}" with no matching Vendor.id`);
    }
  }
}

// ---------- Duplicate slugs (BLOCKING — future unique constraint) ----------

for (const dup of findDuplicates(vendors.map((v) => v.id))) {
  blocking('Duplicate Vendor.id (slug)', dup);
}
for (const dup of findDuplicates(categories.map((c) => c.id))) {
  blocking('Duplicate Category.id (slug)', dup);
}
for (const dup of findDuplicates(blogs.map((b) => b.slug))) {
  blocking('Duplicate Blog.slug', dup);
}

// ---------- Missing required fields (BLOCKING — future NOT NULL columns) ----------

for (const v of vendors) requireFields(v, ['id', 'name', 'category', 'city', 'priceMin', 'priceMax', 'image', 'description'], 'Vendor');
for (const c of categories) requireFields(c, ['id', 'name', 'icon', 'description', 'image'], 'Category');
for (const b of blogs) requireFields(b, ['title', 'slug'], 'Blog', 'slug');
for (const bk of bookings) requireFields(bk, ['name', 'phone', 'city', 'total'], 'Booking', '_id');
for (const e of enquiries) requireFields(e, ['vendorId', 'vendorName', 'vendorCategory', 'name', 'phone', 'city', 'eventDate', 'eventType'], 'Enquiry', '_id');
for (const co of consultations) requireFields(co, ['name', 'phone', 'weddingDate', 'days', 'guestCount'], 'Consultation', '_id');
for (const inv of invoices) requireFields(inv, ['invoiceNumber', 'clientName', 'clientPhone', 'subtotal', 'total'], 'Invoice', 'invoiceNumber');
for (const l of leads) requireFields(l, ['phone'], 'Lead', '_id');
for (const a of applications) requireFields(a, ['businessName', 'ownerName', 'ownerPhone', 'ownerEmail', 'category', 'city'], 'VendorApplication', '_id');

// ---------- Invalid images (WARNING — not enforced today, worth a look) ----------

for (const v of vendors) {
  if (!looksLikeUrl(v.image)) warning('Invalid Vendor.image URL', `Vendor "${v.name}" (${v.id}): "${v.image}"`);
}
for (const c of categories) {
  if (!looksLikeUrl(c.image)) warning('Invalid Category.image URL', `Category "${c.name}" (${c.id}): "${c.image}"`);
}

// ---------- Duplicate phone/email (WARNING — not a unique constraint today) ----------

for (const dup of findDuplicates(vendors.map((v) => v.ownerPhone))) {
  warning('Duplicate Vendor.ownerPhone', dup);
}
for (const dup of findDuplicates(vendors.map((v) => v.ownerEmail))) {
  warning('Duplicate Vendor.ownerEmail', dup);
}

// ---------- Blog category (WARNING — free-text label, not an FK today or in Postgres) ----------

for (const b of blogs) {
  if (!b.category) warning('Blog missing category label', `Blog "${b.title}" (${b.slug})`);
}

// ---------- Report ----------

const blockingIssues = issues.filter((i) => i.level === 'BLOCKING');
const warningIssues = issues.filter((i) => i.level === 'WARNING');

console.log('Migration Readiness Report');
console.log('===========================');
console.log(`Vendors:             ${vendors.length}`);
console.log(`Categories:          ${categories.length}`);
console.log(`Blogs:                ${blogs.length}`);
console.log(`Bookings:             ${bookings.length}`);
console.log(`Enquiries:            ${enquiries.length}`);
console.log(`Consultations:        ${consultations.length}`);
console.log(`Invoices:             ${invoices.length}`);
console.log(`Leads:                ${leads.length}`);
console.log(`Vendor Applications:  ${applications.length}`);
console.log('');
console.log(`Blocking issues: ${blockingIssues.length}`);
console.log(`Warnings:        ${warningIssues.length}`);
console.log('');

if (blockingIssues.length) {
  console.log('❌ BLOCKING ISSUES:');
  for (const i of blockingIssues) console.log(`   [${i.check}] ${i.detail}`);
  console.log('');
}
if (warningIssues.length) {
  console.log('⚠️  WARNINGS (non-blocking, review recommended):');
  for (const i of warningIssues) console.log(`   [${i.check}] ${i.detail}`);
  console.log('');
}

console.log(blockingIssues.length === 0 ? 'READY FOR MIGRATION ✅' : 'NOT READY — resolve blocking issues above ❌');

await client.close();
process.exit(blockingIssues.length === 0 ? 0 : 1);
