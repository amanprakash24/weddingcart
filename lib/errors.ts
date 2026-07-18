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

export class DuplicateError extends Error {
  constructor(
    entity: string,
    public readonly field: string
  ) {
    super(`${entity} already exists with this ${field}`);
    this.name = 'DuplicateError';
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
    }
    throw err;
  }
}
