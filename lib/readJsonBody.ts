import { ValidationError, USER_MESSAGES } from '@/lib/errors';

// Reads a request's JSON body. A missing or broken body is the caller's mistake, not ours: it throws a ValidationError, which
// handleApiError turns into a 400 with the usual "please check" words — instead of a 500 that lands in /admin/errors.
// Returns `any` like Request.json(), so routes keep parsing it with their own schemas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJsonBody(req: Request): Promise<any> {
  const text = await req.text();
  if (!text.trim()) throw new ValidationError(USER_MESSAGES.invalid);
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError(USER_MESSAGES.invalid);
  }
}
