import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { PLATFORM_SCOPE, runAsSystem, runInScope, type Scope } from '@/lib/ownership/scope';
import { PLATFORM_BUSINESS_ID } from '@/lib/ownership/owned';
import { ForbiddenError } from '@/lib/errors';
import { can, type CouplePermission, type CoupleRole } from '@/lib/customer/familyAccess';

// My Wedding — the couple's own dashboard (Vivah OS, 28 Oct 2026). A couple's wedding may belong to Shaadi Shopping or to a venue
// / vendor that runs it on Vivah OS. A couple's login has no business of its own, so — like the proposal link
// (lib/quotation/proposalEntry.ts) — the entry first asks, as named SYSTEM lookups allowlisted in CI, only "which weddings are this
// signed-in couple's, and whose are they", then reads each wedding AS ITS OWN BUSINESS. Every lookup is pinned to the signed-in
// user's id (Wedding.customerId, set only by the wedding's own business — lib/customer/weddingLink.ts, services/coupleLogin.service.ts), never to anything in a request.

export interface CoupleWedding {
  id: string;
  businessId: string;
  // OWNER = the couple (Wedding.customerId); otherwise a family member's role (23 Nov 2026, lib/customer/familyAccess.ts)
  role: CoupleRole;
  relation: string | null;
}

/** The weddings this login may open, oldest date first: the couple's own, and those they were added to as family (23 Nov 2026). */
export async function coupleWeddings(userId: string): Promise<CoupleWedding[]> {
  if (!userId) return [];
  const [own, family] = await Promise.all([
    runAsSystem("couple portal: the signed-in couple's own weddings", () =>
      prisma.wedding.findMany({ where: { customerId: userId }, select: { id: true, businessId: true, primaryDate: true }, orderBy: { primaryDate: 'asc' } })
    ),
    runAsSystem('couple portal: the weddings this login was added to as family', () =>
      prisma.weddingMember.findMany({ where: { userId }, select: { role: true, relation: true, wedding: { select: { id: true, businessId: true, primaryDate: true } } } })
    ),
  ]);
  const rows: (CoupleWedding & { primaryDate: Date })[] = [
    ...own.map((w) => ({ ...w, role: 'OWNER' as const, relation: null })),
    ...family.filter((m) => !own.some((w) => w.id === m.wedding.id)).map((m) => ({ ...m.wedding, role: m.role, relation: m.relation })),
  ];
  return rows.sort((a, b) => a.primaryDate.getTime() - b.primaryDate.getTime()).map(({ primaryDate: _primaryDate, ...w }) => w);
}

/** For the founder's "Couple sign-in" search (28 Oct 2026, founder only): which weddings this sign-in shows, and whose they are —
 *  the number, the date and the business name only, so the founder can confirm it is the right couple before making a new code. */
export async function coupleWeddingSummaries(userId: string): Promise<{ weddingNumber: string; primaryDate: Date; businessName: string }[]> {
  if (!userId) return [];
  const rows = await runAsSystem("founder: which weddings a couple's sign-in shows (Couple sign-in search)", () =>
    prisma.wedding.findMany({ where: { customerId: userId }, select: { weddingNumber: true, primaryDate: true, business: { select: { name: true } } }, orderBy: { primaryDate: 'asc' } })
  );
  return rows.map((w) => ({ weddingNumber: w.weddingNumber, primaryDate: w.primaryDate, businessName: w.business?.name ?? 'Shaadi Shopping' }));
}

/** The scope a wedding is read in: its own business (Shaadi Shopping's weddings as Shaadi Shopping). */
export const weddingScope = (businessId: string): Scope =>
  businessId === PLATFORM_BUSINESS_ID ? PLATFORM_SCOPE : { kind: 'BUSINESS', businessId, role: 'STAFF' };

/** Run `fn` in the business of one of THIS login's weddings; anyone else's wedding is "not found". `need` is what the action
 *  needs (lib/customer/familyAccess.ts). It defaults to the strictest — the couple only — so a route a family member may use says so
 *  explicitly; a family member without the permission gets 403. */
export async function asCoupleWedding<T>(weddingId: string, userId: string, fn: (who: CoupleWedding) => Promise<T>, need: CouplePermission = 'family'): Promise<T> {
  const mine = (await coupleWeddings(userId)).find((w) => w.id === weddingId);
  if (!mine) throw new NotFoundError('Wedding', weddingId);
  if (!can(mine.role, need)) throw new ForbiddenError(need === 'money' ? 'Payments are only for the couple and family with full access' : 'Ask the couple — your access does not include this');
  return runInScope(weddingScope(mine.businessId), () => fn(mine));
}

/** Run `fn` in the business of the wedding an approval request belongs to — only when that wedding is this couple's. */
export async function asCoupleApproval<T>(approvalId: string, userId: string, fn: () => Promise<T>): Promise<T> {
  const found = await runAsSystem("couple portal: which of the couple's weddings this approval is for", () =>
    prisma.approvalRequest.findFirst({ where: { id: approvalId, wedding: { customerId: userId } }, select: { wedding: { select: { businessId: true } } } })
  );
  if (!found?.wedding) throw new NotFoundError('ApprovalRequest', approvalId);
  return runInScope(weddingScope(found.wedding.businessId), fn);
}
