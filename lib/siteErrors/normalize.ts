// Site errors (25 Oct 2026): turn a raw error into a row for /admin/errors. Pure, so it is tested without a database.
//
// Privacy: an address can carry a private link token (/proposal/<token>), record ids or a phone number in its query string.
// Query strings and fragments are dropped, and any path part that looks like an id or token becomes ":id". Messages and
// stack traces are cut short. No IP address is ever kept.
import { createHash } from 'node:crypto';

export type SiteErrorSourceName = 'SERVER' | 'BROWSER';

export interface SiteErrorReport {
  source: SiteErrorSourceName;
  message: string;
  location: string;
  detail?: string | null;
  browser?: string | null;
}

export interface CleanSiteError {
  fingerprint: string;
  source: SiteErrorSourceName;
  message: string;
  location: string;
  detail: string | null;
  browser: string | null;
}

const MAX_MESSAGE = 300;
const MAX_LOCATION = 200;
const MAX_DETAIL = 1500;
const STACK_LINES = 8;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// A path part with a digit and 12+ letters/digits/dashes, or 6+ digits: an id, a token or a phone number.
const ID_LIKE = /^(?=.*\d)[A-Za-z0-9_-]{12,}$|^\d{6,}$/;

function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** "/proposal/abc123token?x=1#y" → "/proposal/:id". Full URLs keep only their path. */
export function cleanLocation(raw: string | null | undefined): string {
  let value = (raw ?? '').trim();
  if (!value) return 'unknown';
  try {
    if (/^https?:\/\//i.test(value)) value = new URL(value).pathname;
  } catch {
    /* keep as written */
  }
  value = value.split(/[?#]/)[0].replace(UUID, ':id');
  const parts = value.split('/').map((part) => (ID_LIKE.test(part) ? ':id' : part));
  return cut(parts.join('/') || '/', MAX_LOCATION);
}

/** One line, no ids or long numbers, short. */
export function cleanMessage(raw: string | null | undefined): string {
  const value = (raw ?? '')
    .replace(/\s+/g, ' ')
    .replace(UUID, ':id')
    .replace(/\b\d{6,}\b/g, ':n')
    .replace(/(https?:\/\/[^\s?#]+)[?#]\S*/g, '$1')
    .trim();
  return cut(value || 'Unknown error', MAX_MESSAGE);
}

/** The first lines of a stack trace, without query strings. */
export function cleanDetail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lines = raw
    .split('\n')
    .slice(0, STACK_LINES)
    .map((line) => line.replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/g, '$1').replace(UUID, ':id').trimEnd());
  const value = lines.join('\n').trim();
  return value ? cut(value, MAX_DETAIL) : null;
}

/** "Mozilla/5.0 (Linux; Android 14 …) Chrome/130…" → "Chrome · Android". */
export function shortBrowser(userAgent: string | null | undefined): string | null {
  const ua = userAgent ?? '';
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other browser';
  const system = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Other';
  return `${browser} · ${system}`;
}

// Errors that are not ours to fix, or not errors at all: browser extensions, a lost connection, a page left mid-request,
// Next.js's own redirect / not-found signals.
const NOISE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /Failed to fetch|NetworkError|Load failed|network error|The network connection was lost/i,
  /AbortError|The (user|operation) aborted|signal is aborted/i,
  /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)/,
  /ChunkLoadError|Loading chunk \S+ failed|Failed to load chunk/i, // an old tab after a deploy; reloading fixes it
  /Non-Error promise rejection captured/i,
];
const NOISE_STACK = /(chrome|moz|safari(-web)?)-extension:\/\//i;

export function isNoise(report: Pick<SiteErrorReport, 'message' | 'detail'>): boolean {
  const message = report.message ?? '';
  if (NOISE.some((pattern) => pattern.test(message))) return true;
  return NOISE_STACK.test(report.detail ?? '');
}

/** The same problem in the same place gets the same fingerprint, whatever ids or numbers were in it. */
export function fingerprintOf(source: SiteErrorSourceName, message: string, location: string): string {
  return createHash('sha256').update(`${source}|${location}|${message}`).digest('hex').slice(0, 32);
}

/** null = ignore it (noise). */
export function cleanSiteError(report: SiteErrorReport): CleanSiteError | null {
  if (isNoise(report)) return null;
  const message = cleanMessage(report.message);
  const location = cleanLocation(report.location);
  return {
    fingerprint: fingerprintOf(report.source, message, location),
    source: report.source,
    message,
    location,
    detail: cleanDetail(report.detail),
    browser: report.source === 'BROWSER' ? shortBrowser(report.browser) : null,
  };
}

/** Where a server error came from when only its stack trace is known: "app/api/leads/route". */
export function routeFromStack(stack: string | null | undefined): string | null {
  const match = (stack ?? '').match(/app[\\/](?:api[\\/])?[^\s:()]*?[\\/](?:route|page)(?=\.[jt]sx?|[\s:)]|$)/);
  return match ? match[0].replace(/\\/g, '/') : null;
}
