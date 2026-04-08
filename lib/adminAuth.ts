import crypto from 'crypto';

const COOKIE_NAME = 'admin_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function hmac(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

const secret = () => process.env.ADMIN_SECRET || 'fallback-secret';

/** Token for regular admin */
export function computeAdminToken(): string {
  return hmac(secret(), `${process.env.ADMIN_USERNAME}:${process.env.ADMIN_PASSWORD}`);
}

/** Token for superadmin */
export function computeSuperAdminToken(): string {
  return hmac(secret(), `${process.env.SUPER_ADMIN_USERNAME}:${process.env.SUPER_ADMIN_PASSWORD}`);
}

/** Returns the correct token if credentials match, null otherwise */
export function verifyCredentials(username: string, password: string): string | null {
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    return computeAdminToken();
  }
  if (username === process.env.SUPER_ADMIN_USERNAME && password === process.env.SUPER_ADMIN_PASSWORD) {
    return computeSuperAdminToken();
  }
  return null;
}

export { COOKIE_NAME, COOKIE_MAX_AGE };
