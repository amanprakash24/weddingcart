import { prisma } from '@/lib/prisma';
import { ConflictError } from '@/lib/errors';
import { isRateLimited, recordLoginAttempt } from '@/lib/auth/rateLimit';
import { isGuessableCode, isWellFormedCode, normalizeMobile } from '@/lib/auth/vendorCode';
import { otpService } from '@/services/otp.service';
import { sendWhatsAppCode, type WhatsAppCodeResult } from '@/lib/whatsappOtp';
import { hashLoginCode } from '@/services/vendorLoginCode.service';
import { coupleOnly, loginSelect, type Login } from '@/services/coupleLogin.service';

// "Forgot your code?" on the couple's sign-in (28 Oct 2026). The couple proves they hold the mobile — a one-time code on WhatsApp
// — and chooses a new 6-digit login code. Nobody else is involved and nobody else ever sees the new code.
//
//  - Couple-only logins (nothing but the couple door, no business). A vendor's or team member's code is changed their own way.
//  - The answer to "send" is the same whether or not the number has a sign-in, so the page never says which numbers are registered;
//    a WhatsApp message (which costs money) is only sent when there is a couple sign-in to reset.
//  - The WhatsApp code: 5 minutes, one at a time, one minute between sends (services/otp.service.ts). 5 wrong tries in 15 minutes
//    lock the number (lib/auth/rateLimit.ts).
//  - The new code signs the couple out everywhere else — anyone who knew the old code (the venue that gave it) is out.

export type ResetErrors = Partial<Record<'mobile' | 'otp' | 'next' | 'confirm', string>>;

export interface CoupleCodeResetDeps {
  db: Pick<typeof prisma, 'user'>;
  requestCode: typeof otpService.requestCode;
  verifyCode: typeof otpService.verifyCode;
  send: (phone: string, code: string) => Promise<WhatsAppCodeResult>;
  isLocked: typeof isRateLimited;
  record: typeof recordLoginAttempt;
  hash: (code: string) => Promise<string>;
  now: () => Date;
}

const defaultDeps = (): CoupleCodeResetDeps => ({
  db: prisma,
  requestCode: (p) => otpService.requestCode(p),
  verifyCode: (p, c) => otpService.verifyCode(p, c),
  send: sendWhatsAppCode,
  isLocked: isRateLimited,
  record: recordLoginAttempt,
  hash: hashLoginCode,
  now: () => new Date(),
});

export function createCoupleCodeResetService(deps: CoupleCodeResetDeps = defaultDeps()) {
  const coupleLogin = async (mobile: string) => {
    const user = (await deps.db.user.findUnique({ where: { phone: mobile }, select: loginSelect })) as Login | null;
    return user && user.roles.length > 0 && coupleOnly(user) ? user : null;
  };

  return {
    // Step 1: send the WhatsApp code. `devCode` only on a computer without WhatsApp set up (never in production).
    async send(mobileInput: unknown): Promise<{ sent: true; devCode?: string } | { errors: ResetErrors }> {
      const mobile = normalizeMobile(mobileInput);
      if (!mobile) return { errors: { mobile: 'Enter your 10-digit mobile number' } };
      if (!(await coupleLogin(mobile))) return { sent: true };
      const requested = await deps.requestCode(mobile);
      if ('waitSeconds' in requested) return { sent: true }; // the code sent a moment ago still works
      const result = await deps.send(mobile, requested.code);
      if (!result.ok) throw new ConflictError('We could not send the WhatsApp message just now. Please message us on WhatsApp and we will help.');
      return result.devCode ? { sent: true, devCode: result.devCode } : { sent: true };
    },

    // Step 2: the WhatsApp code + the new login code twice.
    async confirm(input: { mobile?: unknown; otp?: unknown; next?: unknown; confirm?: unknown }): Promise<{ done: true } | { errors: ResetErrors }> {
      const mobile = normalizeMobile(input.mobile);
      const errors: ResetErrors = {};
      if (!mobile) errors.mobile = 'Enter your 10-digit mobile number';
      if (!isWellFormedCode(input.otp)) errors.otp = 'Enter the 6-digit code from WhatsApp';
      if (!isWellFormedCode(input.next)) errors.next = 'Choose a code of exactly 6 digits';
      else if (isGuessableCode(input.next)) errors.next = 'That code is too easy to guess — please choose another';
      if (!errors.next && input.confirm !== input.next) errors.confirm = 'The two codes do not match';
      if (Object.keys(errors).length || !mobile) return { errors };

      const lock = `couple-reset:${mobile}`;
      if (await deps.isLocked(lock)) throw new ConflictError('Too many wrong tries — please wait 15 minutes and try again');
      const user = await coupleLogin(mobile);
      const ok = !!user && (await deps.verifyCode(mobile, input.otp as string));
      await deps.record(lock, ok);
      if (!ok || !user) return { errors: { otp: 'That WhatsApp code is wrong or has expired. Send a new one.' } };

      await deps.db.user.update({ where: { id: user.id }, data: { loginCodeHash: await deps.hash(input.next as string), loginCodeSetAt: deps.now(), loginCodeGiven: false, sessionVersion: { increment: 1 } } });
      return { done: true };
    },
  };
}

export const coupleCodeResetService = createCoupleCodeResetService();
