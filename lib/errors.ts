import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@/generated/prisma/client';

// Repository error contract — see docs/repository-contract.md.
// Repositories catch known Prisma error codes and rethrow these; anything
// else propagates unwrapped rather than being silently swallowed.

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

// Sprint 5.3 — a stage change rejected by the pipeline state machine
// (lib/crm/pipeline.ts), or a required reason missing for that transition.
export class InvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransitionError';
  }
}

export class DuplicateError extends Error {
  constructor(
    entity: string,
    public readonly field: string
  ) {
    super(`${entity} already exists with this ${field}`);
    this.name = 'DuplicateError';
  }
}

// Milestone 6 — a Lead/Enquiry/Consultation that has already converted into a
// Wedding is read-only for pipeline/deal fields (domain-model.md §5.1). Thrown
// by services/leadWorkspace.service.ts's mutation methods once a Wedding link
// exists; addNote is deliberately exempt (still allowed post-conversion).
export class ConversionLockedError extends Error {
  constructor(message = 'This record has converted to a Wedding and is read-only') {
    super(message);
    this.name = 'ConversionLockedError';
  }
}

// Wraps a repository call, translating known Prisma error codes into the
// typed domain errors above. Unrecognized errors are rethrown as-is.
export async function withPrismaErrors<T>(entity: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') {
        throw new NotFoundError(entity, String(err.meta?.cause ?? 'unknown'));
      }
      if (err.code === 'P2002') {
        const field = Array.isArray(err.meta?.target) ? err.meta.target[0] : String(err.meta?.target ?? 'field');
        throw new DuplicateError(entity, field);
      }
      // Foreign-key restrict violation (e.g. deleting a Vendor that still
      // has VendorBooking/Payout rows referencing it) — the DB-level
      // protection was already correct, it just fell through to a generic
      // 500 with no explanation. Reuses InvalidTransitionError (free-form
      // message, 400) rather than inventing a new error class.
      if (err.code === 'P2003') {
        throw new InvalidTransitionError(`${entity} cannot be deleted: it still has related records referencing it`);
      }
    }
    throw err;
  }
}

// One shared mapping from thrown errors to HTTP responses, per
// docs/repository-contract.md's "that mapping lives in one place" rule —
// first real use is the Sprint 5.2 Lead Workspace mutation routes.
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof NotFoundError) {
    return NextResponse.json({ success: false, error: err.message }, { status: 404 });
  }
  if (err instanceof DuplicateError) {
    return NextResponse.json({ success: false, error: err.message }, { status: 409 });
  }
  if (err instanceof InvalidTransitionError) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
  if (err instanceof ConversionLockedError) {
    return NextResponse.json({ success: false, error: err.message }, { status: 409 });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ success: false, error: 'Invalid request', issues: err.issues }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
}
