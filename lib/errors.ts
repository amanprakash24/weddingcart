import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { columnFromIndex, constraintFromMeta, friendlyDuplicateMessage } from '@/lib/duplicateConstraint';

// Repository error contract — see docs/repository-contract.md.
// Repositories catch known Prisma error codes and rethrow these; anything
// else propagates unwrapped rather than being silently swallowed.

export class NotFoundError extends Error {
  readonly entity: string;
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`); // the id stays in logs; users get publicMessage (handleApiError)
    this.name = 'NotFoundError';
    this.entity = entity;
  }
}

// The words a user sees (MASTER-GAP-ANALYSIS §2.6, brief §19: no technical errors, no ids). Technical details stay in the logs.
export const USER_MESSAGES = {
  invalid: 'Some details are missing or not valid — please check and try again.',
  unexpected: 'Something went wrong — please try again. If it keeps happening, tell the team.',
} as const;

export function notFoundMessage(entity: string): string {
  const thing = entity.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return `This ${thing} could not be found — it may have been removed. Please reload the page.`;
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
    public readonly field: string,
    // The database's own name for the rule that was hit (e.g. "quotations_supersedesId_key"), when known — returned to the
    // client and logged so a failure can be traced to the exact rule. `message` overrides the default sentence.
    public readonly constraint: string | null = null,
    message?: string
  ) {
    super(message ?? `${entity} already exists with this ${field}`);
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

// A request that is well-formed but breaks a business rule the schema can't express
// (e.g. a discount larger than the subtotal). Maps to 400 with its own message.
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// The request is valid but conflicts with the current state of the record
// (e.g. editing a quotation that has already been sent). Maps to 409.
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
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
        const info = constraintFromMeta(err.meta);
        const field = info.fields[0] ?? columnFromIndex(info.index) ?? 'field';
        throw new DuplicateError(entity, field, info.index, friendlyDuplicateMessage(entity, info));
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
    console.warn(err.message);
    return NextResponse.json({ success: false, error: notFoundMessage(err.entity) }, { status: 404 });
  }
  if (err instanceof DuplicateError) {
    if (err.constraint) console.warn(`duplicate: ${err.message} (rule: ${err.constraint})`);
    return NextResponse.json({ success: false, error: err.message, ...(err.constraint ? { constraint: err.constraint } : {}) }, { status: 409 });
  }
  if (err instanceof InvalidTransitionError) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
  if (err instanceof ValidationError) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
  if (err instanceof ConflictError) {
    return NextResponse.json({ success: false, error: err.message }, { status: 409 });
  }
  if (err instanceof ConversionLockedError) {
    return NextResponse.json({ success: false, error: err.message }, { status: 409 });
  }
  if (err instanceof ZodError) {
    // `issues` stays for forms that show one message per field (lib/apiFieldErrors.ts).
    return NextResponse.json({ success: false, error: USER_MESSAGES.invalid, issues: err.issues }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ success: false, error: USER_MESSAGES.unexpected }, { status: 500 });
}
