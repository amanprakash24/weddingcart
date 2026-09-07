/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { z } from 'zod';
import {
  handleApiError,
  NotFoundError,
  DuplicateError,
  InvalidTransitionError,
  ConversionLockedError,
} from './errors';

async function bodyOf(res: Response) {
  return res.json();
}

describe('handleApiError — shared error-to-HTTP-response mapping', () => {
  test('NotFoundError maps to 404 with its own message', async () => {
    const res = handleApiError(new NotFoundError('Event', 'abc123'));
    expect(res.status).toBe(404);
    expect((await bodyOf(res)).error).toBe('Event not found: abc123');
  });

  test('DuplicateError maps to 409', async () => {
    const res = handleApiError(new DuplicateError('Event', 'slug'));
    expect(res.status).toBe(409);
  });

  test('InvalidTransitionError maps to 400 with its own message', async () => {
    const res = handleApiError(new InvalidTransitionError('Sales limit reached for this pass type'));
    expect(res.status).toBe(400);
    expect((await bodyOf(res)).error).toBe('Sales limit reached for this pass type');
  });

  test('ConversionLockedError maps to 409', async () => {
    const res = handleApiError(new ConversionLockedError());
    expect(res.status).toBe(409);
  });

  test('ZodError maps to 400 with issues', async () => {
    const schema = z.object({ name: z.string() });
    const result = schema.safeParse({ name: 123 });
    expect(result.success).toBe(false);
    if (result.success) return;
    const res = handleApiError(result.error);
    expect(res.status).toBe(400);
    const body = await bodyOf(res);
    expect(body.issues).toBeDefined();
  });

  // The core "don't leak internals" guarantee this shared function exists
  // for: any error that isn't one of the typed domain errors above — a raw
  // Prisma internal, a third-party library's own error text, anything
  // unanticipated — must NEVER have its .message echoed to the client.
  test('an unrecognized/unexpected error maps to a generic 500, never echoing its own message', async () => {
    const sensitiveMessage = 'relation "events" does not exist at column vendor_payment_details.bankAccountNumber';
    const res = handleApiError(new Error(sensitiveMessage));
    expect(res.status).toBe(500);
    const body = await bodyOf(res);
    expect(body.error).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain(sensitiveMessage);
  });

  test('a non-Error thrown value also maps to a generic 500, never echoing itself', async () => {
    const res = handleApiError('a raw string throw, e.g. from third-party code');
    expect(res.status).toBe(500);
    const body = await bodyOf(res);
    expect(body.error).toBe('Internal server error');
  });
});
