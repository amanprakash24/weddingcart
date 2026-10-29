import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { Role } from '@/lib/auth/roles';
import { coupleMobile } from '@/lib/customer/weddingLink';
import { hashLoginCode, newLoginCode, vendorLoginCodeService } from '@/services/vendorLoginCode.service';

// The couple's sign-in to My Wedding (28 Oct 2026): mobile number + their own 6-digit login code — the same sign-in as everyone
// else on Vivah OS (services/vendorLoginCode.service.ts). The WhatsApp one-time code is no longer used for couples.
//
// A couple gets their code from the business whose wedding it is: a venue on Vivah OS from its wedding page, Shaadi Shopping from
// the Command Center. Always called inside that business's scope, so the wedding is always the caller's own.
//
// THE RULES — whoever issues a code can sign in with it, so:
//   - A code is made only for a mobile number that has NO login yet. The new login is the couple's (CUSTOMER) and this wedding is
//     linked to it.
//   - A number that already has a login keeps its code; it is never replaced from here. This wedding is linked to that login, so it
//     shows on their My Wedding, and they sign in with the code they already have.
//   - Only the founder may replace an existing couple's code (a lost code, or a couple from before codes) — and never for a login
//     that is also a vendor's or a team member's; those people change their own code.
//   - A wedding is shown to a couple only when its own business links it (here), or when it is created for a number that already
//     has a couple login (lib/customer/weddingLink.ts). Nothing is linked "by phone" at sign-in: a code someone else issued must not
//     open other businesses' weddings.
//   - A wedding already linked to one login is never moved to another.

export type CoupleLoginStatus =
  | { state: 'NO_MOBILE' }
  | { state: 'NOT_SET_UP'; mobile: string }
  // hasCode: the login can sign in. linked: this wedding shows on their My Wedding. canReplace: the founder may make a new code.
  | { state: 'HAS_LOGIN'; mobile: string; hasCode: boolean; linked: boolean; canReplace: boolean }
  | { state: 'OTHER_LOGIN'; mobile: string }; // this wedding is already linked to a different login than the one with this number

export type GiveResult =
  | { kind: 'NEW_CODE'; mobile: string; code: string } // shown once — only a hash is kept
  | { kind: 'LINKED'; mobile: string; hasCode: boolean }; // an existing login: this wedding now shows there; its code is unchanged

export interface CoupleLoginDeps {
  db: typeof prisma;
  hash: (code: string) => Promise<string>;
  newCode: () => string;
  issueForUser: (userId: string) => Promise<{ code: string; mobile: string | null }>;
  now: () => Date;
}

const defaultDeps = (): CoupleLoginDeps => ({
  db: prisma,
  hash: hashLoginCode,
  newCode: newLoginCode,
  issueForUser: (userId) => vendorLoginCodeService.issueForUser(userId),
  now: () => new Date(),
});

const loginSelect = { id: true, loginCodeHash: true, roles: { select: { role: true } }, _count: { select: { businessMemberships: true } } } as const;
type Login = { id: string; loginCodeHash: string | null; roles: { role: Role }[]; _count: { businessMemberships: number } };

// Only a couple's own login may have its code replaced by the founder: nothing but the couple door, and no business it works in.
const coupleOnly = (l: Login) => l.roles.every((r) => r.role === Role.CUSTOMER) && l._count.businessMemberships === 0;

export function createCoupleLoginService(deps: CoupleLoginDeps = defaultDeps()) {
  // The caller's own wedding (the scope filters out every other business's) and the couple's mobile on it.
  async function wedding(weddingId: string) {
    const w = await deps.db.wedding.findFirst({ where: { id: weddingId }, select: { id: true, customerId: true, customerPhone: true, sourceBooking: { select: { name: true, phone: true } } } });
    if (!w) throw new NotFoundError('Wedding', weddingId);
    return { ...w, mobile: coupleMobile(w.customerPhone) ?? coupleMobile(w.sourceBooking?.phone) };
  }

  const loginFor = (mobile: string) => deps.db.user.findUnique({ where: { phone: mobile }, select: loginSelect }) as Promise<Login | null>;

  // Link this wedding to the couple's login, once. Re-pointing a wedding already linked to someone else is refused.
  async function link(db: Pick<typeof prisma, 'wedding'>, weddingId: string, userId: string, mobile: string) {
    const { count } = await db.wedding.updateMany({ where: { id: weddingId, OR: [{ customerId: null }, { customerId: userId }] }, data: { customerId: userId, customerPhone: mobile } });
    if (count === 0) throw new ConflictError('This wedding is already linked to another sign-in. Please ask Shaadi Shopping.');
  }

  return {
    // What the wedding page shows about the couple's sign-in. `founder`: the caller may replace a code.
    async status(weddingId: string, founder = false): Promise<CoupleLoginStatus> {
      const w = await wedding(weddingId);
      if (!w.mobile) return { state: 'NO_MOBILE' };
      const login = await loginFor(w.mobile);
      if (!login) return w.customerId ? { state: 'OTHER_LOGIN', mobile: w.mobile } : { state: 'NOT_SET_UP', mobile: w.mobile };
      if (w.customerId && w.customerId !== login.id) return { state: 'OTHER_LOGIN', mobile: w.mobile };
      return { state: 'HAS_LOGIN', mobile: w.mobile, hasCode: !!login.loginCodeHash, linked: w.customerId === login.id, canReplace: founder && coupleOnly(login) };
    },

    // Give the couple My Wedding: a new login with a new code, or — when the number already has a login — this wedding linked to it.
    async give(weddingId: string): Promise<GiveResult> {
      const w = await wedding(weddingId);
      if (!w.mobile) throw new ConflictError("Add the couple's 10-digit mobile number to this wedding first");
      const mobile = w.mobile;
      return deps.db.$transaction(async (tx) => {
        const existing = (await tx.user.findUnique({ where: { phone: mobile }, select: loginSelect })) as Login | null;
        if (existing) {
          await tx.userRole.upsert({ where: { userId_role: { userId: existing.id, role: Role.CUSTOMER } }, create: { userId: existing.id, role: Role.CUSTOMER }, update: {} });
          await link(tx, w.id, existing.id, mobile);
          return { kind: 'LINKED' as const, mobile, hasCode: !!existing.loginCodeHash };
        }
        const code = deps.newCode();
        let userId: string;
        try {
          userId = (await tx.user.create({
            data: { phone: mobile, name: w.sourceBooking?.name?.trim() || null, loginCodeHash: await deps.hash(code), loginCodeSetAt: deps.now(), loginCodeGiven: true, roles: { create: { role: Role.CUSTOMER } } },
            select: { id: true },
          })).id;
        } catch (err) {
          if ((err as { code?: string })?.code === 'P2002') throw new ConflictError('Someone signed up with this number a moment ago — please try again');
          throw err;
        }
        await link(tx, w.id, userId, mobile);
        return { kind: 'NEW_CODE' as const, mobile, code };
      });
    },

    // The founder replaces the couple's code (lost, or never had one). The old code stops working; they are signed out everywhere.
    // The route allows SUPER_ADMIN only.
    async replace(weddingId: string): Promise<{ mobile: string; code: string }> {
      const w = await wedding(weddingId);
      if (!w.mobile) throw new ConflictError("Add the couple's 10-digit mobile number to this wedding first");
      const login = await loginFor(w.mobile);
      if (!login) throw new ConflictError('This couple has no sign-in yet — give them one first');
      if (w.customerId && w.customerId !== login.id) throw new ConflictError('This wedding is linked to another sign-in. Please check the mobile number.');
      if (!coupleOnly(login)) throw new ConflictError('This number is also a vendor or team sign-in. Only that person can change its code.');
      await link(deps.db, w.id, login.id, w.mobile);
      const { code } = await deps.issueForUser(login.id);
      return { mobile: w.mobile, code };
    },
  };
}

export const coupleLoginService = createCoupleLoginService();
