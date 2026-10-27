import { runAsSystem } from '@/lib/ownership/scope';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeIndianMobile } from '@/lib/indianPhone';

// A couple's login (phone + OTP, role CUSTOMER) ↔ their wedding (MASTER-GAP-ANALYSIS §2.4.1). The link is the couple's mobile:
// stored on the wedding when it is created (from the enquiry / booking it came from) and matched against the login.
//  • at creation — if a CUSTOMER login with that mobile already exists, the wedding is linked at once;
//  • at login — every not-yet-linked wedding with that mobile is linked. OTP has just proved the person owns the number.
// Only CUSTOMER logins are ever linked (a vendor or staff account with the same phone is not). A wedding already linked is never
// re-pointed to someone else.

type Db = Prisma.TransactionClient | typeof prisma;

// The 10-digit mobile OTP logins use, or null when the source phone can't be one.
export const coupleMobile = (raw: string | null | undefined): string | null => (raw ? normalizeIndianMobile(raw) : null);

async function customerUserId(db: Db, mobile: string): Promise<string | null> {
  const user = await db.user.findFirst({ where: { phone: mobile, roles: { some: { role: 'CUSTOMER' } } }, select: { id: true } });
  return user?.id ?? null;
}

// The fields to put on a new wedding.
export async function weddingCustomerFields(db: Db, sourcePhone: string | null | undefined): Promise<Pick<Prisma.WeddingCreateInput, 'customerPhone' | 'customer'>> {
  const mobile = coupleMobile(sourcePhone);
  if (!mobile) return {};
  const userId = await customerUserId(db, mobile);
  return { customerPhone: mobile, ...(userId ? { customer: { connect: { id: userId } } } : {}) };
}

// Called on every customer OTP login. Returns how many weddings were linked. Never throws (a login must not fail because of it).
export async function linkWeddingsOnLogin(userId: string, phone: string, db: Db = prisma): Promise<number> {
  try {
    const mobile = coupleMobile(phone);
    if (!mobile) return 0;
    const isCustomer = await db.userRole.findFirst({ where: { userId, role: 'CUSTOMER' }, select: { userId: true } });
    if (!isCustomer) return 0;
    // A login has no business of its own, and a couple's wedding may be Shaadi Shopping's or a venue's on Vivah OS — My Wedding
    // shows either (28 Oct 2026, lib/customer/coupleEntry.ts). So this is a named SYSTEM write, allowlisted in CI, pinned to the
    // mobile OTP has just verified and to weddings nobody is linked to yet.
    const { count } = await runAsSystem('couple login: link weddings by the OTP-verified mobile', () => db.wedding.updateMany({ where: { customerPhone: mobile, customerId: null }, data: { customerId: userId } }));
    return count;
  } catch (err) {
    console.error('linking weddings on login failed:', err instanceof Error ? err.message : err);
    return 0;
  }
}
