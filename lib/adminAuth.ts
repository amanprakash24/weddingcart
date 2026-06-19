import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'admin_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const s = process.env.ADMIN_SECRET;
  if (!s) throw new Error('ADMIN_SECRET environment variable is not set');
  return s;
}

function hmac(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function computeAdminToken(): string {
  return hmac(getSecret(), `${process.env.ADMIN_USERNAME}:${process.env.ADMIN_PASSWORD}`);
}

export function computeSuperAdminToken(): string {
  return hmac(getSecret(), `${process.env.SUPER_ADMIN_USERNAME}:${process.env.SUPER_ADMIN_PASSWORD}`);
}

export function verifyCredentials(username: string, password: string): string | null {
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    return computeAdminToken();
  }
  if (username === process.env.SUPER_ADMIN_USERNAME && password === process.env.SUPER_ADMIN_PASSWORD) {
    return computeSuperAdminToken();
  }
  return null;
}

export async function requireAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return token === computeAdminToken() || token === computeSuperAdminToken();
}

export { COOKIE_NAME, COOKIE_MAX_AGE };
