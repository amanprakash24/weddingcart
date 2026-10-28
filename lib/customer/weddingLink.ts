import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeIndianMobile } from '@/lib/indianPhone';

// A couple's login (mobile + their 6-digit login code, role CUSTOMER) ↔ their wedding (MASTER-GAP-ANALYSIS §2.4.1). The link is the
// couple's mobile, stored on the wedding when it is created (from the enquiry / booking it came from). A wedding is linked to a login
//  • at creation — if a CUSTOMER login with that mobile already exists;
//  • when the wedding's own business gives the couple My Wedding (services/coupleLogin.service.ts).
// Never at sign-in by phone (28 Oct 2026): a code a venue issued must not open other businesses' weddings. Only CUSTOMER logins are
// linked, and a wedding already linked is never re-pointed to someone else.

type Db = Prisma.TransactionClient | typeof prisma;

// The 10-digit mobile logins use, or null when the source phone can't be one.
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
