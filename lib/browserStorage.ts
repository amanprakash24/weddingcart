// The visitor's browser storage, safely (10 Nov 2026). Some browsers refuse it — Android in-app browsers, a private window, or
// "block site data" — and then even READING `window.localStorage` throws a SecurityError. Unguarded, that error crashed the whole
// page into "Something went wrong" (site error on /blog/court-marriage-registration-patna-bihar, 6 Nov 2026). Everything here
// fails quietly instead: a remembered cart or a dismissed popup is a convenience, never a reason for the page to break.
// Client-safe; pure apart from the storage it is given.

type Kind = 'local' | 'session';

function store(kind: Kind): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null; // the browser refuses storage for this page
  }
}

export function readStored(key: string, kind: Kind = 'local'): string | null {
  try {
    return store(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

// Returns false when it could not be kept (storage refused or full) — callers carry on either way.
export function writeStored(key: string, value: string, kind: Kind = 'local'): boolean {
  try {
    const s = store(kind);
    if (!s) return false;
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
