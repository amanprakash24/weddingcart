// HTTP handlers for site errors (25 Oct 2026), as factories with their dependencies passed in (tested without a database).
// Route files only wire in the real ones.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/errors';
import { cleanSiteError, type CleanSiteError } from './normalize';

const NO_STORE = { 'Cache-Control': 'no-store' };
const done = () => new NextResponse(null, { status: 204, headers: NO_STORE });

// A visitor's browser reports at most a few errors per page (components/SiteErrorReporter.tsx); this is the ceiling per IP.
export const BROWSER_REPORT_LIMIT = { max: 20, windowMinutes: 15 } as const;

const browserReport = z.object({
  message: z.string().max(2000),
  location: z.string().max(1000),
  detail: z.string().max(8000).nullish(),
});

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

// Browsers always send Origin on a cross-site POST; only our own pages may report.
export function isCrossOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.get('host');
  } catch {
    return true;
  }
}

export interface BrowserReportDeps {
  isLimited: (id: string, opts: { max: number; windowMinutes: number }) => Promise<boolean>;
  recordRequest: (id: string) => Promise<void>;
  save: (error: CleanSiteError) => Promise<void>;
}

// POST /api/site-errors — public. Answers 204 whatever happens to the report (a visitor's page never waits on it), except
// 403 for another website and 429 over the limit.
export function makeReportBrowserError(deps: BrowserReportDeps) {
  return async (req: NextRequest) => {
    if (isCrossOrigin(req)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    const id = `site-error:${clientIp(req)}`;
    if (await deps.isLimited(id, BROWSER_REPORT_LIMIT)) return NextResponse.json({ success: false, error: 'Too many reports' }, { status: 429 });
    await deps.recordRequest(id);
    const parsed = browserReport.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return done();
    const clean = cleanSiteError({ source: 'BROWSER', ...parsed.data, browser: req.headers.get('user-agent') });
    if (!clean) return done();
    try {
      await deps.save(clean);
    } catch (err) {
      console.error('[site-errors] could not save a browser report:', err);
    }
    return done();
  };
}

type Session = { user: { id?: string | null } } | null;
const unauthorized = () => NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

export interface StaffDeps {
  requireAdmin: () => Promise<Session>;
  list: (status: 'open' | 'fixed') => Promise<unknown[]>;
  countRecentOpen: () => Promise<number>;
  setFixed: (id: string, fixed: boolean) => Promise<unknown>;
}

// GET /api/admin/site-errors?status=open|fixed  (?summary=1 → only the number for the Today page)
export function makeListSiteErrors(deps: StaffDeps) {
  return async (req: NextRequest) => {
    if (!(await deps.requireAdmin())) return unauthorized();
    try {
      const params = req.nextUrl.searchParams;
      const recentOpen = await deps.countRecentOpen();
      if (params.get('summary') === '1') return NextResponse.json({ success: true, data: { recentOpen } }, { headers: NO_STORE });
      const status = params.get('status') === 'fixed' ? 'fixed' : 'open';
      return NextResponse.json({ success: true, data: { status, recentOpen, errors: await deps.list(status) } }, { headers: NO_STORE });
    } catch (err) {
      return handleApiError(err);
    }
  };
}

const fixedBody = z.object({ fixed: z.boolean() });

// PATCH /api/admin/site-errors/[id]  { fixed: true | false }
export function makeSetSiteErrorFixed(deps: StaffDeps) {
  return async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    if (!(await deps.requireAdmin())) return unauthorized();
    try {
      const { id } = await ctx.params;
      const { fixed } = fixedBody.parse(await req.json().catch(() => null));
      return NextResponse.json({ success: true, data: await deps.setFixed(id, fixed) }, { headers: NO_STORE });
    } catch (err) {
      return handleApiError(err);
    }
  };
}
