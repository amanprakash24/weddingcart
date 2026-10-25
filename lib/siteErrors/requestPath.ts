import { AsyncLocalStorage } from 'node:async_hooks';

// The address of the API request being handled, so a site error caught deep inside a route (handleApiError) can say which
// API it came from — its stack trace only names built files. Set by the route entry wrapper (lib/ownership/entry.ts),
// separate from the ownership scope. Holds only the path; lib/siteErrors/normalize.ts blanks ids out of it before saving.
const storage = new AsyncLocalStorage<string>();

export function withRequestPath<T>(maybeRequest: unknown, fn: () => T): T {
  const url = maybeRequest && typeof maybeRequest === 'object' && 'url' in maybeRequest ? (maybeRequest as { url: unknown }).url : null;
  if (typeof url !== 'string') return fn();
  let path: string;
  try {
    path = new URL(url, 'http://local').pathname;
  } catch {
    return fn();
  }
  return storage.run(path, fn);
}

export function currentRequestPath(): string | null {
  return storage.getStore() ?? null;
}
