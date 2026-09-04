import { randomInt } from 'crypto';
import { otpRepository } from '@/repositories/otp.repository';

// Re-implements the Mongo-era OTP rules (lib/models/OTP.ts: 60s resend cooldown,
// 5min TTL) against Postgres, per docs/security-checklist.md item #3 — the
// Mongo TTL index doesn't carry over, so expiry is enforced on read
// (otpRepository.findValid) instead of via auto-deletion.
const RESEND_COOLDOWN_SECONDS = 60;
const OTP_TTL_MINUTES = 5;

function generateCode(): string {
  return randomInt(100000, 1000000).toString();
}

export const otpService = {
  // Returns the code to send, or null if the caller must wait out the cooldown.
  async requestCode(phone: string): Promise<{ code: string } | { waitSeconds: number }> {
    const latest = await otpRepository.findLatestByPhone(phone);
    if (latest) {
      const ageSeconds = (Date.now() - latest.createdAt.getTime()) / 1000;
      if (ageSeconds < RESEND_COOLDOWN_SECONDS) {
        return { waitSeconds: Math.ceil(RESEND_COOLDOWN_SECONDS - ageSeconds) };
      }
    }

    const code = generateCode();
    // Only one live OTP per phone at a time, same as the Mongo behavior.
    await otpRepository.deleteByPhone(phone);
    await otpRepository.create({
      phone,
      code,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    });
    return { code };
  },

  async verifyCode(phone: string, code: string): Promise<boolean> {
    const otp = await otpRepository.findValid(phone, code);
    if (!otp) return false;
    await otpRepository.deleteById(otp.id);
    return true;
  },
};
