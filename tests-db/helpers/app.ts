// Harness for the real-database tests (docs/testing/testing-guide.md). Run with `bun run test:db`.
//
// Import order matters, so this file imports NOTHING that touches a database: lib/prisma reads DATABASE_URL
// once, when it is first imported. loadApp() checks the safety guard, overrides DATABASE_URL with
// TEST_DATABASE_URL, and only then imports the real services — so the tests can never bind to whatever
// DATABASE_URL happens to be in the developer's shell or .env files.
import { describe } from 'bun:test';
import { assertSafeTestDatabaseUrl, describeTestTarget } from '@/lib/testing/dbGuard';

// NOTE: tests make many round trips to a remote database, so `bun run test:db` passes --timeout 180000 (bun's 5 s default
// is far too short, and a timed-out test keeps running in the background and starves the next ones of connections).

// Enabled only when a test database is configured AND these files were asked for by path (`bun test tests-db`).
// In an ordinary `bun test`, unit-test files mock @/lib/prisma for the whole process, so the real services could
// not reach a database anyway — better to skip cleanly than to fail confusingly.
export const DB_TESTS_ENABLED =
  Boolean(process.env.TEST_DATABASE_URL?.trim()) && process.argv.some((arg) => arg.replace(/\\/g, '/').includes('tests-db'));

export const dbDescribe = DB_TESTS_ENABLED ? describe : describe.skip;

export async function loadApp() {
  const url = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  process.env.DATABASE_URL = url; // never the developer's own DATABASE_URL
  console.log(`[db tests] target: ${describeTestTarget(url)}`);

  const { prisma } = await import('@/lib/prisma');
  const { quotationService } = await import('@/services/quotation.service');
  const { bookingService } = await import('@/services/booking.service');
  const conversion = await import('@/services/weddingConversion.service');
  const { leadWorkspaceService } = await import('@/services/leadWorkspace.service');
  const { weddingWorkspaceService } = await import('@/services/weddingWorkspace.service');
  const { paymentService } = await import('@/services/payment.service');
  const { commandCenterService } = await import('@/services/commandCenter.service');
  const { generateInvoiceNumber } = await import('@/services/documentNumber.service');
  const { monthBucket } = await import('@/lib/numbering');

  return {
    url,
    prisma,
    quotationService,
    bookingService,
    convertBookingToWedding: conversion.convertBookingToWedding,
    convertLeadToWedding: conversion.convertLeadToWedding,
    findWeddingForSource: conversion.findWeddingForSource,
    leadWorkspaceService,
    weddingWorkspaceService,
    paymentService,
    commandCenterService,
    generateInvoiceNumber,
    monthBucket,
  };
}

export type App = Awaited<ReturnType<typeof loadApp>>;

// Counts how a batch of concurrent calls ended.
export function tally(results: PromiseSettledResult<unknown>[]) {
  const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  return {
    ok: results.filter((r) => r.status === 'fulfilled').length,
    conflicts: rejected.filter((r) => r.reason?.name === 'ConflictError').length,
    other: rejected.filter((r) => r.reason?.name !== 'ConflictError').map((r) => `${r.reason?.name}: ${r.reason?.message}`),
  };
}

export const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);
