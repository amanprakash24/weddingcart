import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkDatabase } from '@/lib/health';

// GET /api/health/db — can the site reach its database right now? For the watcher (.github/workflows/watch-live.yml), NOT for a
// load balancer: /api/health stays database-free on purpose. One `SELECT 1`, nothing read from any table, nothing written.
// 200 { status: 'ok' } or 503 { status: 'down' } — never the reason: an error's text could name the database host or user.
export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await checkDatabase(() => prisma.$queryRaw`SELECT 1`);
  if (!result.ok) console.error(`[health] database ${result.reason} after ${result.ms}ms`);
  return NextResponse.json({ status: result.ok ? 'ok' : 'down' }, { status: result.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
