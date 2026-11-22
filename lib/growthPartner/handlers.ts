// HTTP handlers for the Growth Partner Program (docs/wedding-os/14-growth-partner.md), as factories with their
// dependencies passed in (tested without replacing shared modules). Route files only wire in the real ones.
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';
import type { Role } from '@/lib/auth/roles';
import { canSeeCompanyFinancials } from '@/lib/auth/financialAccess';
import { PARTNER_STATUSES, REFERRAL_STATUSES, REFERRAL_TYPES, type PartnerStatus, type ReferralStatus, type ReferralType } from '@/lib/growthPartner/labels';

type Session = { user: { id?: string | null; roles?: readonly Role[] } } | null;
const NO_STORE = { 'Cache-Control': 'no-store' };
const unauthorized = () => NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
const tooMany = () => NextResponse.json({ success: false, error: 'Too many requests. Please try again in a few minutes.' }, { status: 429 });

export const REGISTER_LIMIT = { max: 5, windowMinutes: 15 } as const;
export const REFERRAL_LIMIT = { max: 10, windowMinutes: 15 } as const;

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export interface PublicDeps {
  isLimited: (id: string, opts: { max: number; windowMinutes: number }) => Promise<boolean>;
  record: (id: string) => Promise<void>;
  register: (input: Record<string, unknown>) => Promise<unknown>;
  submitReferral: (input: Record<string, unknown>) => Promise<unknown>;
}

async function body(req: NextRequest): Promise<Record<string, unknown>> {
  const b = await req.json().catch(() => null);
  return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
}

// POST /api/growth-partner/register
export function makeRegister(deps: PublicDeps) {
  return async (req: NextRequest) => {
    const id = `gp-register:${clientIp(req)}`;
    if (await deps.isLimited(id, REGISTER_LIMIT)) return tooMany();
    await deps.record(id);
    try {
      return NextResponse.json({ success: true, data: await deps.register(await body(req)) }, { headers: NO_STORE });
    } catch (err) {
      return handleApiError(err);
    }
  };
}

// POST /api/growth-partner/referrals — every request counts (including a wrong code), so codes can't be guessed.
export function makeSubmitReferral(deps: PublicDeps) {
  return async (req: NextRequest) => {
    const id = `gp-referral:${clientIp(req)}`;
    if (await deps.isLimited(id, REFERRAL_LIMIT)) return tooMany();
    await deps.record(id);
    try {
      return NextResponse.json({ success: true, data: await deps.submitReferral(await body(req)) }, { headers: NO_STORE });
    } catch (err) {
      return handleApiError(err);
    }
  };
}

export interface StaffDeps {
  requireAdmin: () => Promise<Session>;
  listPartners: (f: { status?: PartnerStatus; city?: string }) => Promise<unknown>;
  stats: () => Promise<unknown>;
  updatePartner: (id: string, input: Record<string, unknown>) => Promise<unknown>;
  listReferrals: (f: { status?: ReferralStatus; type?: ReferralType; partnerId?: string }) => Promise<unknown>;
  updateReferral: (id: string, input: Record<string, unknown>) => Promise<unknown>;
}
type Ctx = { params: Promise<{ id: string }> };

// Partner payouts are company money (founder decision, 21 Nov 2026; lib/auth/financialAccess.ts): payout amounts, the payouts-due
// and paid totals, and setting a payout are for the founder. The team still works referrals (status, assignee, notes).
const seesMoney = (session: Session) => canSeeCompanyFinancials(session?.user?.roles);
const withoutPayout = (row: unknown) => (row && typeof row === 'object' ? { ...(row as Record<string, unknown>), payoutAmount: null } : row);
const payoutForbidden = () => NextResponse.json({ success: false, error: 'Only the founder can set partner payouts' }, { status: 403, headers: NO_STORE });
const pick = <T extends string>(v: string | null, allowed: readonly T[]): T | undefined => (v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

// GET /api/admin/growth-partners?status=&city= → partners + the headline numbers
export function makeListPartners(deps: StaffDeps) {
  return async (req: NextRequest) => {
    const session = await deps.requireAdmin();
    if (!session) return unauthorized();
    try {
      const q = req.nextUrl.searchParams;
      const [partners, rawStats] = await Promise.all([deps.listPartners({ status: pick(q.get('status'), PARTNER_STATUSES), city: q.get('city')?.trim() || undefined }), deps.stats()]);
      const stats = seesMoney(session) || !rawStats || typeof rawStats !== 'object' ? rawStats : { ...(rawStats as Record<string, unknown>), payoutsDue: null, totalPaid: null };
      return NextResponse.json({ success: true, data: { partners, stats } }, { headers: NO_STORE });
    } catch (err) {
      return handleApiError(err);
    }
  };
}

// PATCH /api/admin/growth-partners/[id]
export function makeUpdatePartner(deps: StaffDeps) {
  return async (req: NextRequest, { params }: Ctx) => {
    if (!(await deps.requireAdmin())) return unauthorized();
    try {
      return NextResponse.json({ success: true, data: await deps.updatePartner((await params).id, await body(req)) }, { headers: NO_STORE });
    } catch (err) {
      return handleApiError(err);
    }
  };
}

// GET /api/admin/growth-partner-referrals?status=&type=&partnerId=
export function makeListReferrals(deps: StaffDeps) {
  return async (req: NextRequest) => {
    const session = await deps.requireAdmin();
    if (!session) return unauthorized();
    try {
      const q = req.nextUrl.searchParams;
      const rows = await deps.listReferrals({ status: pick(q.get('status'), REFERRAL_STATUSES), type: pick(q.get('type'), REFERRAL_TYPES), partnerId: q.get('partnerId') || undefined });
      const data = seesMoney(session) || !Array.isArray(rows) ? rows : rows.map(withoutPayout);
      return NextResponse.json({ success: true, data }, { headers: NO_STORE });
    } catch (err) {
      return handleApiError(err);
    }
  };
}

// PATCH /api/admin/growth-partner-referrals/[id]
export function makeUpdateReferral(deps: StaffDeps) {
  return async (req: NextRequest, { params }: Ctx) => {
    const session = await deps.requireAdmin();
    if (!session) return unauthorized();
    try {
      const input = await body(req);
      const money = seesMoney(session);
      if (!money && input && typeof input === 'object' && ('payoutAmount' in input || 'payoutStatus' in input)) return payoutForbidden();
      const updated = await deps.updateReferral((await params).id, input);
      return NextResponse.json({ success: true, data: money ? updated : withoutPayout(updated) }, { headers: NO_STORE });
    } catch (err) {
      return handleApiError(err);
    }
  };
}
