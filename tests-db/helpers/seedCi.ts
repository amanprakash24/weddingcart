// Reference data for an EMPTY test database (CI): the few rows the database tests read but never create — vendors to book,
// their categories, and one staff user. Everything is fictional and marked "CI".
//
// Same safety rule as the tests themselves (lib/testing/dbGuard.ts): it runs only against TEST_DATABASE_URL, which must be an
// explicitly allowed test database and never production or the app's own DATABASE_URL. Idempotent (upserts by slug / email).
//
//   bun tests-db/helpers/seedCi.ts
import { assertSafeTestDatabaseUrl, describeTestTarget } from '@/lib/testing/dbGuard';

const url = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL);
process.env.DATABASE_URL = url;
console.log(`[seed] target: ${describeTestTarget(url)}`);
const { prisma } = await import('@/lib/prisma');

// In slug order, matching how the tests pick vendors (fx.vendors orders by slug): venue, catering, decoration, photography, DJ.
const VENDORS = [
  { slug: 'ci-a-venue', name: 'CI Grand Ballroom', category: { slug: 'ci-venues', name: 'Venues' } },
  { slug: 'ci-b-catering', name: 'CI Caterers', category: { slug: 'ci-catering', name: 'Catering' } },
  { slug: 'ci-c-decoration', name: 'CI Decorators', category: { slug: 'ci-decorators', name: 'Decorators' } },
  { slug: 'ci-d-photography', name: 'CI Photo & Video', category: { slug: 'ci-photo-video', name: 'Photo & Video' } },
  { slug: 'ci-e-dj', name: 'CI DJ & Sound', category: { slug: 'ci-dj', name: 'DJ' } },
];

for (const v of VENDORS) {
  const category = await prisma.category.upsert({
    where: { slug: v.category.slug },
    update: {},
    create: { slug: v.category.slug, name: v.category.name, icon: 'ci', description: 'CI test category', image: 'https://example.test/ci.jpg' },
  });
  await prisma.vendor.upsert({
    where: { slug: v.slug },
    update: {},
    create: { slug: v.slug, name: v.name, categoryId: category.id, city: 'Patna', priceMin: 1000, priceMax: 2000, image: 'https://example.test/ci.jpg', description: 'CI test vendor' },
  });
}

await prisma.user.upsert({
  where: { email: 'ci-staff@example.test' },
  update: {},
  create: { email: 'ci-staff@example.test', name: 'CI Staff', roles: { create: { role: 'SUPER_ADMIN' } } },
});

console.log(`[seed] ${VENDORS.length} vendors, ${VENDORS.length} categories, 1 staff user`);
await prisma.$disconnect();
