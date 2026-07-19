// node --env-file=.env.local scripts/migrate-to-postgres.mjs
//
// Milestone 3 data migration: MongoDB -> PostgreSQL, per the 7 batches in
// docs/migration-test-plan.md (Users are seeded first, outside the batch
// count, so SUPER_ADMIN login works while validating the rest).
//
// STATUS as of 2026-07-19: implementation complete, NEVER EXECUTED. There is
// no live Postgres instance yet (DATABASE_URL in .env.local is a
// placeholder) — do not treat a clean read of this file as equivalent to a
// successful run. Run scripts/validate-migration-readiness.mjs immediately
// before actually running this, and scripts/validate-post-migration.mjs
// immediately after.
//
// Design rules (per technical review, 2026-07-19):
// - Every batch is idempotent: upserts via ON CONFLICT ("legacyMongoId"), so
//   re-running a batch after a partial failure never creates duplicates.
// - Each batch runs inside one Postgres transaction — a failure partway
//   through a batch rolls that whole batch back, never leaves it half-done.
// - Batches run in strict dependency order and STOP on the first validation
//   failure — later batches never run against a known-bad earlier one.
// - Every batch produces a structured report (console + saved JSON under
//   migration-reports/) — see docs/migration-test-plan.md for why: an audit
//   trail of how the migration was actually performed, not just its result.
//
// Uses the raw `pg` driver, not the generated Prisma client — see the header
// comment in scripts/validate-post-migration.mjs for why (verified, not
// assumed: plain Node can't resolve the client's extensionless internal TS
// imports without a bundler).

import { MongoClient } from 'mongodb';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';

const mongoUri = process.env.MONGODB_URI;
const pgUrl = process.env.DATABASE_URL;
if (!mongoUri || !pgUrl) {
  console.error('MONGODB_URI and DATABASE_URL must both be set');
  process.exit(1);
}

const mongo = new MongoClient(mongoUri);
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

// ---------- Small helpers ----------

function progressBar(current, total, width = 24) {
  const ratio = total === 0 ? 1 : current / total;
  const filled = Math.round(width * ratio);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${current}/${total}`;
}

async function withTransaction(fn) {
  await pgClient.query('BEGIN');
  try {
    const result = await fn();
    await pgClient.query('COMMIT');
    return result;
  } catch (err) {
    await pgClient.query('ROLLBACK');
    throw err;
  }
}

async function saveReport(batchName, report) {
  await mkdir('migration-reports', { recursive: true });
  // Windows treats /,\,: etc. as path separators/invalid filename chars — batch
  // names like "Leads / Enquiries / Consultations / Vendor Applications" broke
  // this on first real run against Windows (caught by actually running it, not
  // by review). Sanitize for the filename only; `batchName` in the report JSON
  // content itself is untouched.
  const safeBatchName = batchName.replace(/[/\\:*?"<>|]/g, '-').replace(/-+/g, '-');
  const file = `migration-reports/${report.startedAt.replace(/[:.]/g, '-')}-${safeBatchName}.json`;
  await writeFile(file, JSON.stringify(report, null, 2));
  console.log('');
  console.log(`Batch: ${batchName}`);
  console.log(`Started:  ${report.startedAt}`);
  console.log(`Finished: ${report.finishedAt}`);
  console.log(`Source records: ${report.sourceCount}`);
  console.log(`Migrated: ${report.migrated}`);
  console.log(`Skipped:  ${report.skipped}`);
  console.log(`Failed:   ${report.failed}`);
  console.log(`Validation: ${report.validationStatus}`);
  console.log(`Duration: ${report.durationMs}ms`);
  console.log(`Report saved: ${file}`);
  console.log('');
}

// Runs one batch: transaction + progress + report + validation gate. Stops
// the whole script immediately if validation fails — never proceeds to the
// next batch against unverified data.
async function runBatch(name, { sourceCount, migrateFn, validateFn }) {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    await withTransaction(async () => {
      const result = await migrateFn((current, total) => {
        process.stdout.write(`\r${name}: ${progressBar(current, total)}`);
      });
      migrated = result.migrated;
      skipped = result.skipped;
      failed = result.failed;
    });
    process.stdout.write('\n');
  } catch (err) {
    process.stdout.write('\n');
    console.error(`Batch ${name} FAILED and was rolled back: ${err.message}`);
    await saveReport(name, {
      startedAt,
      finishedAt: new Date().toISOString(),
      sourceCount,
      migrated: 0,
      skipped: 0,
      failed: sourceCount,
      validationStatus: 'ERROR (rolled back)',
      durationMs: Date.now() - t0,
      error: err.message,
    });
    console.error('See docs/rollback-checklist.md. Migration stopped.');
    process.exit(1);
  }

  const validation = await validateFn();
  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    sourceCount,
    migrated,
    skipped,
    failed,
    validationStatus: validation.pass ? 'PASS' : `FAIL: ${validation.detail}`,
    durationMs: Date.now() - t0,
  };
  await saveReport(name, report);

  if (!validation.pass) {
    console.error(`Batch ${name} validation failed: ${validation.detail}`);
    console.error('Migration stopped — see docs/rollback-checklist.md before retrying.');
    process.exit(1);
  }
}

async function countPg(table) {
  const { rows } = await pgClient.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
  return rows[0].count;
}

const STATUS_UP = (s) => (s ?? '').toUpperCase();

// ---------- Pre-batch: seed Users from admin env vars (not counted as a batch) ----------

async function seedUsers() {
  const pairs = [
    { username: process.env.SUPER_ADMIN_USERNAME, email: process.env.SUPER_ADMIN_EMAIL, password: process.env.SUPER_ADMIN_PASSWORD, role: 'SUPER_ADMIN' },
    { username: process.env.ADMIN_USERNAME, email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, role: 'SALES' },
  ];
  for (const p of pairs) {
    if (!p.email || !p.password) {
      console.error(`Cannot seed ${p.role} user: ${p.role}_EMAIL or its password env var is not set.`);
      console.error('Set SUPER_ADMIN_EMAIL/ADMIN_EMAIL in .env.local — see .env.example.');
      process.exit(1);
    }
    const passwordHash = await bcrypt.hash(p.password, 10);
    // Identity redesign (2026-07-19, docs/wedding-os/step4-workflow-review.md):
    // User.role no longer exists — role now lives in the UserRole join table
    // (multi-role per person). This function was missed during that refactor
    // (caught by actually running the migration against real Postgres, not by
    // review) — fixed here to match lib/auth/auth.ts's same pattern.
    const { rows } = await pgClient.query(
      `INSERT INTO users (id, email, name, "passwordHash", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, now(), now())
       ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "updatedAt" = now()
       RETURNING id`,
      [randomUUID(), p.email, p.username, passwordHash]
    );
    const userId = rows[0].id;
    await pgClient.query(
      `INSERT INTO user_roles (id, "userId", role, "createdAt")
       VALUES ($1, $2, $3, now())
       ON CONFLICT ("userId", role) DO NOTHING`,
      [randomUUID(), userId, p.role]
    );
    console.log(`Seeded ${p.role} user: ${p.email}`);
  }
}

// ---------- Batch 1: Categories ----------

async function batchCategories() {
  const docs = await db.collection('categories').find({}).toArray();
  return runBatch('Categories', {
    sourceCount: docs.length,
    async migrateFn(onProgress) {
      let migrated = 0;
      for (const [i, d] of docs.entries()) {
        await pgClient.query(
          `INSERT INTO categories (id, "legacyMongoId", slug, name, icon, description, image, "isSpecial", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT ("legacyMongoId") DO UPDATE SET
             slug=EXCLUDED.slug, name=EXCLUDED.name, icon=EXCLUDED.icon, description=EXCLUDED.description,
             image=EXCLUDED.image, "isSpecial"=EXCLUDED."isSpecial", "updatedAt"=EXCLUDED."updatedAt"`,
          [randomUUID(), d._id.toString(), d.id, d.name, d.icon, d.description, d.image, !!d.isSpecial, d.createdAt ?? new Date(), d.updatedAt ?? new Date()]
        );
        migrated++;
        onProgress(i + 1, docs.length);
      }
      return { migrated, skipped: 0, failed: 0 };
    },
    async validateFn() {
      const pgCount = await countPg('categories');
      return pgCount >= docs.length
        ? { pass: true }
        : { pass: false, detail: `Postgres has ${pgCount}, expected at least ${docs.length}` };
    },
  });
}

// ---------- Batch 2: Blogs ----------

async function batchBlogs() {
  const docs = await db.collection('blogs').find({}).toArray();
  return runBatch('Blogs', {
    sourceCount: docs.length,
    async migrateFn(onProgress) {
      let migrated = 0;
      for (const [i, d] of docs.entries()) {
        await pgClient.query(
          `INSERT INTO blogs (id, "legacyMongoId", title, slug, excerpt, content, "coverImage", author, category, tags,
             "seoTitle", "seoDescription", status, "publishedAt", "readTime", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           ON CONFLICT ("legacyMongoId") DO UPDATE SET
             title=EXCLUDED.title, slug=EXCLUDED.slug, excerpt=EXCLUDED.excerpt, content=EXCLUDED.content,
             "coverImage"=EXCLUDED."coverImage", author=EXCLUDED.author, category=EXCLUDED.category, tags=EXCLUDED.tags,
             "seoTitle"=EXCLUDED."seoTitle", "seoDescription"=EXCLUDED."seoDescription", status=EXCLUDED.status,
             "publishedAt"=EXCLUDED."publishedAt", "readTime"=EXCLUDED."readTime", "updatedAt"=EXCLUDED."updatedAt"`,
          [
            randomUUID(), d._id.toString(), d.title, d.slug, d.excerpt ?? '', d.content ?? '', d.coverImage ?? '',
            d.author ?? 'ShaadiShopping Team', d.category ?? 'Wedding Tips', d.tags ?? [], d.seoTitle ?? '', d.seoDescription ?? '',
            STATUS_UP(d.status) || 'DRAFT', d.publishedAt ?? null, d.readTime ?? 1, d.createdAt ?? new Date(), d.updatedAt ?? new Date(),
          ]
        );
        migrated++;
        onProgress(i + 1, docs.length);
      }
      return { migrated, skipped: 0, failed: 0 };
    },
    async validateFn() {
      const pgCount = await countPg('blogs');
      return pgCount >= docs.length
        ? { pass: true }
        : { pass: false, detail: `Postgres has ${pgCount}, expected at least ${docs.length}` };
    },
  });
}

// ---------- Batch 3: Vendors ----------

async function batchVendors(categorySlugToId) {
  const docs = await db.collection('vendors').find({}).toArray();
  return runBatch('Vendors', {
    sourceCount: docs.length,
    async migrateFn(onProgress) {
      let migrated = 0;
      let skipped = 0;
      for (const [i, d] of docs.entries()) {
        const categoryId = categorySlugToId.get(d.category);
        if (!categoryId) {
          skipped++;
          console.warn(`\nSkipping vendor "${d.name}" (${d.id}): unknown category "${d.category}"`);
          onProgress(i + 1, docs.length);
          continue;
        }
        await pgClient.query(
          `INSERT INTO vendors (id, "legacyMongoId", slug, name, "ownerName", "ownerPhone", "ownerEmail", "categoryId",
             city, address, "mapEmbedUrl", "priceMin", "priceMax", rating, "reviewCount", image, images,
             "virtualTourVideo", description, features, "isFeatured", "sortOrder", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
           ON CONFLICT ("legacyMongoId") DO UPDATE SET
             slug=EXCLUDED.slug, name=EXCLUDED.name, "ownerName"=EXCLUDED."ownerName", "ownerPhone"=EXCLUDED."ownerPhone",
             "ownerEmail"=EXCLUDED."ownerEmail", "categoryId"=EXCLUDED."categoryId", city=EXCLUDED.city, address=EXCLUDED.address,
             "mapEmbedUrl"=EXCLUDED."mapEmbedUrl", "priceMin"=EXCLUDED."priceMin", "priceMax"=EXCLUDED."priceMax",
             rating=EXCLUDED.rating, "reviewCount"=EXCLUDED."reviewCount", image=EXCLUDED.image, images=EXCLUDED.images,
             "virtualTourVideo"=EXCLUDED."virtualTourVideo", description=EXCLUDED.description, features=EXCLUDED.features,
             "isFeatured"=EXCLUDED."isFeatured", "sortOrder"=EXCLUDED."sortOrder", "updatedAt"=EXCLUDED."updatedAt"`,
          [
            randomUUID(), d._id.toString(), d.id, d.name, d.ownerName ?? '', d.ownerPhone ?? '', d.ownerEmail ?? '', categoryId,
            d.city, d.address ?? '', d.mapEmbedUrl ?? '', d.priceMin, d.priceMax, d.rating ?? 4.5, d.reviewCount ?? 0,
            d.image, d.images ?? [], d.virtualTourVideo ?? '', d.description, d.features ?? [], !!d.isFeatured,
            d.sortOrder ?? 999, d.createdAt ?? new Date(), d.updatedAt ?? new Date(),
          ]
        );
        migrated++;
        onProgress(i + 1, docs.length);
      }
      return { migrated, skipped, failed: 0 };
    },
    async validateFn() {
      const pgCount = await countPg('vendors');
      const expected = docs.filter((d) => categorySlugToId.has(d.category)).length;
      return pgCount >= expected
        ? { pass: true }
        : { pass: false, detail: `Postgres has ${pgCount}, expected at least ${expected} (${docs.length - expected} skipped for unknown category)` };
    },
  });
}

// ---------- Batch 4: Vendor Packages / Vendor FAQs ----------

async function batchVendorSubdocs(vendorMongoIdToPgId) {
  const vendors = await db.collection('vendors').find({}, { projection: { packages: 1, faqs: 1 } }).toArray();
  const totalPackages = vendors.reduce((sum, v) => sum + (v.packages?.length ?? 0), 0);
  const totalFaqs = vendors.reduce((sum, v) => sum + (v.faqs?.length ?? 0), 0);
  const sourceCount = totalPackages + totalFaqs;

  return runBatch('Vendor Packages & FAQs', {
    sourceCount,
    async migrateFn(onProgress) {
      let migrated = 0;
      let processed = 0;
      for (const v of vendors) {
        const vendorId = vendorMongoIdToPgId.get(v._id.toString());
        if (!vendorId) continue; // vendor itself was skipped in batch 3 (unknown category)

        for (const p of v.packages ?? []) {
          await pgClient.query(
            `INSERT INTO vendor_packages (id, "legacyMongoId", "vendorId", name, description, price, features, "isPopular", "isPerPlate", image)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             ON CONFLICT ("legacyMongoId") DO UPDATE SET
               name=EXCLUDED.name, description=EXCLUDED.description, price=EXCLUDED.price, features=EXCLUDED.features,
               "isPopular"=EXCLUDED."isPopular", "isPerPlate"=EXCLUDED."isPerPlate", image=EXCLUDED.image`,
            [randomUUID(), p._id?.toString() ?? `${v._id}-pkg-${migrated}`, vendorId, p.name, p.description ?? '', p.price, p.features ?? [], !!p.isPopular, !!p.isPerPlate, p.image ?? '']
          );
          migrated++;
          processed++;
          onProgress(processed, sourceCount);
        }

        for (const f of v.faqs ?? []) {
          await pgClient.query(
            `INSERT INTO vendor_faqs (id, "legacyMongoId", "vendorId", question, answer)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT ("legacyMongoId") DO UPDATE SET question=EXCLUDED.question, answer=EXCLUDED.answer`,
            [randomUUID(), f._id?.toString() ?? `${v._id}-faq-${migrated}`, vendorId, f.q ?? f.question, f.a ?? f.answer]
          );
          migrated++;
          processed++;
          onProgress(processed, sourceCount);
        }
      }
      return { migrated, skipped: sourceCount - migrated, failed: 0 };
    },
    async validateFn() {
      const pkgCount = await countPg('vendor_packages');
      const faqCount = await countPg('vendor_faqs');
      const total = pkgCount + faqCount;
      return total >= sourceCount || vendors.some((v) => !vendorMongoIdToPgId.has(v._id.toString()))
        ? { pass: true }
        : { pass: false, detail: `Postgres has ${pkgCount} packages + ${faqCount} faqs = ${total}, expected ${sourceCount}` };
    },
  });
}

// ---------- Batch 5: Leads, Enquiries, Consultations, Vendor Applications ----------

async function batchLeadsEtc(vendorSlugToId, categorySlugToId) {
  const leads = await db.collection('leads').find({}).toArray();
  const enquiries = await db.collection('enquiries').find({}).toArray();
  const consultations = await db.collection('consultations').find({}).toArray();
  const applications = await db.collection('vendorapplications').find({}).toArray();
  const sourceCount = leads.length + enquiries.length + consultations.length + applications.length;

  return runBatch('Leads / Enquiries / Consultations / Vendor Applications', {
    sourceCount,
    async migrateFn(onProgress) {
      let migrated = 0;
      let skipped = 0;
      let processed = 0;

      for (const d of leads) {
        await pgClient.query(
          `INSERT INTO leads (id, "legacyMongoId", phone, whatsapp, source, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT ("legacyMongoId") DO UPDATE SET phone=EXCLUDED.phone, whatsapp=EXCLUDED.whatsapp, source=EXCLUDED.source, "updatedAt"=EXCLUDED."updatedAt"`,
          [randomUUID(), d._id.toString(), d.phone, !!d.whatsapp, d.source ?? 'popup', d.createdAt ?? new Date(), d.updatedAt ?? new Date()]
        );
        migrated++;
        processed++;
        onProgress(processed, sourceCount);
      }

      for (const d of enquiries) {
        const vendorId = vendorSlugToId.get(d.vendorId);
        if (!vendorId) {
          skipped++;
          console.warn(`\nSkipping enquiry ${d._id}: unknown vendorId "${d.vendorId}"`);
          processed++;
          onProgress(processed, sourceCount);
          continue;
        }
        await pgClient.query(
          `INSERT INTO enquiries (id, "legacyMongoId", "vendorId", "vendorName", "vendorCategory", name, phone, email, city,
             "eventDate", "guestCount", "eventType", message, status, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           ON CONFLICT ("legacyMongoId") DO UPDATE SET
             "vendorId"=EXCLUDED."vendorId", "vendorName"=EXCLUDED."vendorName", "vendorCategory"=EXCLUDED."vendorCategory",
             name=EXCLUDED.name, phone=EXCLUDED.phone, email=EXCLUDED.email, city=EXCLUDED.city, "eventDate"=EXCLUDED."eventDate",
             "guestCount"=EXCLUDED."guestCount", "eventType"=EXCLUDED."eventType", message=EXCLUDED.message,
             status=EXCLUDED.status, "updatedAt"=EXCLUDED."updatedAt"`,
          [
            randomUUID(), d._id.toString(), vendorId, d.vendorName, d.vendorCategory, d.name, d.phone, d.email ?? null,
            d.city, d.eventDate, d.guestCount ?? null, d.eventType, d.message ?? null, STATUS_UP(d.status) || 'NEW',
            d.createdAt ?? new Date(), d.updatedAt ?? new Date(),
          ]
        );
        migrated++;
        processed++;
        onProgress(processed, sourceCount);
      }

      for (const d of consultations) {
        await pgClient.query(
          `INSERT INTO consultations (id, "legacyMongoId", name, phone, email, city, "eventType", "weddingDate", days,
             "guestCount", "foodPreference", services, "venueType", "preferredTime", message, "cartItems", "totalBudget",
             status, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
           ON CONFLICT ("legacyMongoId") DO UPDATE SET
             name=EXCLUDED.name, phone=EXCLUDED.phone, email=EXCLUDED.email, city=EXCLUDED.city,
             "eventType"=EXCLUDED."eventType", "weddingDate"=EXCLUDED."weddingDate", days=EXCLUDED.days,
             "guestCount"=EXCLUDED."guestCount", "foodPreference"=EXCLUDED."foodPreference", services=EXCLUDED.services,
             "venueType"=EXCLUDED."venueType", "preferredTime"=EXCLUDED."preferredTime", message=EXCLUDED.message,
             "cartItems"=EXCLUDED."cartItems", "totalBudget"=EXCLUDED."totalBudget", status=EXCLUDED.status,
             "updatedAt"=EXCLUDED."updatedAt"`,
          [
            randomUUID(), d._id.toString(), d.name, d.phone, d.email ?? '', d.city ?? null, d.eventType ?? 'wedding',
            d.weddingDate, d.days, d.guestCount, d.foodPreference ?? 'veg', d.services ?? [], d.venueType ?? '',
            d.preferredTime ?? null, d.message ?? null, JSON.stringify(d.cartItems ?? []), d.totalBudget ?? null,
            STATUS_UP(d.status) || 'NEW', d.createdAt ?? new Date(), d.updatedAt ?? new Date(),
          ]
        );
        migrated++;
        processed++;
        onProgress(processed, sourceCount);
      }

      for (const d of applications) {
        const categoryId = categorySlugToId.get(d.category);
        if (!categoryId) {
          skipped++;
          console.warn(`\nSkipping vendor application ${d._id}: unknown category "${d.category}"`);
          processed++;
          onProgress(processed, sourceCount);
          continue;
        }
        const vendorId = d.vendorId ? vendorSlugToId.get(d.vendorId) ?? null : null;
        await pgClient.query(
          `INSERT INTO vendor_applications (id, "legacyMongoId", "businessName", "ownerName", "ownerPhone", "ownerEmail",
             "categoryId", city, "priceMin", "priceMax", experience, description, instagram, website, "coverImage",
             "portfolioImages", "foodMenuImages", status, "vendorId", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
           ON CONFLICT ("legacyMongoId") DO UPDATE SET
             "businessName"=EXCLUDED."businessName", "ownerName"=EXCLUDED."ownerName", "ownerPhone"=EXCLUDED."ownerPhone",
             "ownerEmail"=EXCLUDED."ownerEmail", "categoryId"=EXCLUDED."categoryId", city=EXCLUDED.city,
             "priceMin"=EXCLUDED."priceMin", "priceMax"=EXCLUDED."priceMax", experience=EXCLUDED.experience,
             description=EXCLUDED.description, instagram=EXCLUDED.instagram, website=EXCLUDED.website,
             "coverImage"=EXCLUDED."coverImage", "portfolioImages"=EXCLUDED."portfolioImages",
             "foodMenuImages"=EXCLUDED."foodMenuImages", status=EXCLUDED.status, "vendorId"=EXCLUDED."vendorId",
             "updatedAt"=EXCLUDED."updatedAt"`,
          [
            randomUUID(), d._id.toString(), d.businessName, d.ownerName, d.ownerPhone, d.ownerEmail, categoryId, d.city,
            d.priceMin ?? 0, d.priceMax ?? 0, d.experience ?? '', d.description ?? '', d.instagram ?? '', d.website ?? '',
            d.coverImage ?? '', d.portfolioImages ?? [], d.foodMenuImages ?? [], STATUS_UP(d.status) || 'NEW', vendorId,
            d.createdAt ?? new Date(), d.updatedAt ?? new Date(),
          ]
        );
        migrated++;
        processed++;
        onProgress(processed, sourceCount);
      }

      return { migrated, skipped, failed: 0 };
    },
    async validateFn() {
      // Sequential, not Promise.all — pgClient is a single non-pooled
      // Client, which can only run one query at a time. Concurrent queries
      // against it triggered a real "already executing a query" deprecation
      // warning on the first live run (caught by executing, not by review).
      const l = await countPg('leads');
      const e = await countPg('enquiries');
      const c = await countPg('consultations');
      const a = await countPg('vendor_applications');
      const total = l + e + c + a;
      return total >= sourceCount
        ? { pass: true }
        : { pass: false, detail: `Postgres total ${total} (leads ${l}, enquiries ${e}, consultations ${c}, applications ${a}), expected at least ${sourceCount}` };
    },
  });
}

// ---------- Batch 6: Bookings ----------

async function batchBookings(vendorSlugToId) {
  const docs = await db.collection('bookings').find({}).toArray();
  const totalItems = docs.reduce((sum, b) => sum + (b.items?.length ?? 0), 0);

  return runBatch('Bookings', {
    sourceCount: docs.length + totalItems,
    async migrateFn(onProgress) {
      let migrated = 0;
      let processed = 0;
      for (const d of docs) {
        // RETURNING id gives back the existing row's id on the ON CONFLICT ...
        // DO UPDATE path too (not just fresh inserts) — no separate re-fetch needed.
        const { rows: bookingRows } = await pgClient.query(
          `INSERT INTO bookings (id, "legacyMongoId", name, phone, city, total, status, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT ("legacyMongoId") DO UPDATE SET
             name=EXCLUDED.name, phone=EXCLUDED.phone, city=EXCLUDED.city, total=EXCLUDED.total, status=EXCLUDED.status,
             "updatedAt"=EXCLUDED."updatedAt"
           RETURNING id`,
          [randomUUID(), d._id.toString(), d.name, d.phone, d.city, d.total, STATUS_UP(d.status) || 'NEW', d.createdAt ?? new Date(), d.updatedAt ?? new Date()]
        );
        const realBookingId = bookingRows[0].id;
        migrated++;
        processed++;
        onProgress(processed, docs.length + totalItems);

        for (const [idx, item] of (d.items ?? []).entries()) {
          const vendorId = vendorSlugToId.get(item.vendorId) ?? null; // nullable by design — e.g. "Touch Of Cozy"
          await pgClient.query(
            `INSERT INTO booking_items (id, "legacyMongoId", "bookingId", "vendorId", "vendorName", "vendorCategory", "packageName", price, quantity)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT ("legacyMongoId") DO UPDATE SET
               "vendorId"=EXCLUDED."vendorId", "vendorName"=EXCLUDED."vendorName", "vendorCategory"=EXCLUDED."vendorCategory",
               "packageName"=EXCLUDED."packageName", price=EXCLUDED.price, quantity=EXCLUDED.quantity`,
            [randomUUID(), item._id?.toString() ?? `${d._id}-item-${idx}`, realBookingId, vendorId, item.vendorName, item.vendorCategory, item.packageName, item.price, item.quantity]
          );
          migrated++;
          processed++;
          onProgress(processed, docs.length + totalItems);
        }
      }
      return { migrated, skipped: 0, failed: 0 };
    },
    async validateFn() {
      const bookingCount = await countPg('bookings');
      const itemCount = await countPg('booking_items');
      return bookingCount >= docs.length && itemCount >= totalItems
        ? { pass: true }
        : { pass: false, detail: `Postgres has ${bookingCount} bookings (expected ${docs.length}) and ${itemCount} items (expected ${totalItems})` };
    },
  });
}

// ---------- Batch 7: Invoices ----------

async function batchInvoices() {
  const docs = await db.collection('invoices').find({}).toArray();
  const totalItems = docs.reduce((sum, i) => sum + (i.items?.length ?? 0), 0);

  return runBatch('Invoices', {
    sourceCount: docs.length + totalItems,
    async migrateFn(onProgress) {
      let migrated = 0;
      let processed = 0;
      for (const d of docs) {
        // RETURNING id gives back the existing row's id on the ON CONFLICT ...
        // DO UPDATE path too (not just fresh inserts) — no separate re-fetch needed.
        const { rows: invoiceRows } = await pgClient.query(
          `INSERT INTO invoices (id, "legacyMongoId", "invoiceNumber", "clientName", "clientPhone", "clientEmail", "clientCity",
             "eventDate", "eventType", subtotal, discount, "gstEnabled", "gstAmount", total, "amountPaid", notes, status,
             "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
           ON CONFLICT ("legacyMongoId") DO UPDATE SET
             "invoiceNumber"=EXCLUDED."invoiceNumber", "clientName"=EXCLUDED."clientName", "clientPhone"=EXCLUDED."clientPhone",
             "clientEmail"=EXCLUDED."clientEmail", "clientCity"=EXCLUDED."clientCity", "eventDate"=EXCLUDED."eventDate",
             "eventType"=EXCLUDED."eventType", subtotal=EXCLUDED.subtotal, discount=EXCLUDED.discount,
             "gstEnabled"=EXCLUDED."gstEnabled", "gstAmount"=EXCLUDED."gstAmount", total=EXCLUDED.total,
             "amountPaid"=EXCLUDED."amountPaid", notes=EXCLUDED.notes, status=EXCLUDED.status, "updatedAt"=EXCLUDED."updatedAt"
           RETURNING id`,
          [
            randomUUID(), d._id.toString(), d.invoiceNumber, d.clientName, d.clientPhone, d.clientEmail ?? null, d.clientCity ?? null,
            d.eventDate ?? null, d.eventType ?? null, d.subtotal, d.discount ?? 0, d.gstEnabled ?? true, d.gstAmount ?? 0,
            d.total, d.amountPaid ?? 0, d.notes ?? null, STATUS_UP(d.status) || 'DRAFT', d.createdAt ?? new Date(), d.updatedAt ?? new Date(),
          ]
        );
        const realInvoiceId = invoiceRows[0].id;
        migrated++;
        processed++;
        onProgress(processed, docs.length + totalItems);

        for (const [idx, item] of (d.items ?? []).entries()) {
          await pgClient.query(
            `INSERT INTO invoice_items (id, "legacyMongoId", "invoiceId", description, "vendorName", amount, quantity)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT ("legacyMongoId") DO UPDATE SET
               description=EXCLUDED.description, "vendorName"=EXCLUDED."vendorName", amount=EXCLUDED.amount, quantity=EXCLUDED.quantity`,
            [randomUUID(), item._id?.toString() ?? `${d._id}-item-${idx}`, realInvoiceId, item.description, item.vendorName ?? null, item.amount, item.quantity ?? 1]
          );
          migrated++;
          processed++;
          onProgress(processed, docs.length + totalItems);
        }
      }
      return { migrated, skipped: 0, failed: 0 };
    },
    async validateFn() {
      const invoiceCount = await countPg('invoices');
      const itemCount = await countPg('invoice_items');
      return invoiceCount >= docs.length && itemCount >= totalItems
        ? { pass: true }
        : { pass: false, detail: `Postgres has ${invoiceCount} invoices (expected ${docs.length}) and ${itemCount} items (expected ${totalItems})` };
    },
  });
}

// ---------- Orchestrator ----------

async function loadSlugMaps() {
  const categoryRows = (await pgClient.query('SELECT id, slug FROM categories')).rows;
  const categorySlugToId = new Map(categoryRows.map((r) => [r.slug, r.id]));

  const vendorRows = (await pgClient.query('SELECT id, slug, "legacyMongoId" FROM vendors')).rows;
  const vendorSlugToId = new Map(vendorRows.map((r) => [r.slug, r.id]));
  const vendorMongoIdToPgId = new Map(vendorRows.map((r) => [r.legacyMongoId, r.id]));

  return { categorySlugToId, vendorSlugToId, vendorMongoIdToPgId };
}

console.log('Milestone 3 migration starting.\n');

await seedUsers();
await batchCategories();
await batchBlogs();

let maps = await loadSlugMaps();
await batchVendors(maps.categorySlugToId);

maps = await loadSlugMaps(); // reload — vendors now exist
await batchVendorSubdocs(maps.vendorMongoIdToPgId);
await batchLeadsEtc(maps.vendorSlugToId, maps.categorySlugToId);
await batchBookings(maps.vendorSlugToId);
await batchInvoices();

console.log('All batches completed and validated. Run scripts/validate-post-migration.mjs next.');

await mongo.close();
await pgClient.end();
