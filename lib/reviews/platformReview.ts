// Reviews of Shaadi Shopping itself (24 Nov 2026) — the public /review page. Pure rules shared by the API, the page and the tests.

export const REVIEW_PAGE_PATH = '/review';
export const NAME_MAX = 60;
export const COMMENT_MAX = 1000;
// A person may send a few reviews (a typo, a second family member); a script may not send hundreds.
export const REVIEW_SUBMIT_LIMIT = { max: 5, windowMinutes: 60 } as const;

export interface PlatformReviewInput {
  authorName: unknown;
  rating: unknown;
  comment?: unknown;
  phone?: unknown;
  weddingNumber?: unknown;
  website?: unknown; // honeypot: hidden from people; a bot that fills it is quietly ignored
}

export interface CleanPlatformReview {
  authorName: string;
  rating: number;
  comment: string | null;
  phone: string | null;
  weddingNumber: string | null;
}

const text = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

// A 10-digit Indian mobile from "+91 98765 43210", "098765-43210" …; '' → null; anything else → undefined.
function mobile(v: unknown): string | null | undefined {
  const raw = text(v);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '').replace(/^(?:91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : undefined;
}

export const isBot = (input: PlatformReviewInput) => text(input.website) !== '';

// The cleaned review, or the first problem in words the person can act on.
export function checkPlatformReview(input: PlatformReviewInput): { ok: true; value: CleanPlatformReview } | { ok: false; error: string } {
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: 'Please choose 1 to 5 stars' };
  const authorName = text(input.authorName);
  if (authorName.length < 2) return { ok: false, error: 'Please add your name' };
  if (authorName.length > NAME_MAX) return { ok: false, error: `Keep your name under ${NAME_MAX} characters` };
  const comment = typeof input.comment === 'string' ? input.comment.trim() : '';
  if (comment.length > COMMENT_MAX) return { ok: false, error: `Keep your review under ${COMMENT_MAX} characters` };
  const phone = mobile(input.phone);
  if (phone === undefined) return { ok: false, error: 'Mobile should be a 10-digit number (or leave it empty)' };
  const wedding = text(input.weddingNumber).toUpperCase();
  if (wedding && !/^WED-\d{4}-\d{4}$/.test(wedding)) return { ok: false, error: 'Wedding ID looks like WED-2026-0002 (or leave it empty)' };
  return { ok: true, value: { authorName, rating, comment: comment || null, phone, weddingNumber: wedding || null } };
}

// The name shown publicly: first name and the first letter of the rest ("Pratik A."), so a full name is never published.
export function publicName(authorName: string): string {
  const [first, ...rest] = authorName.trim().split(/\s+/);
  const initial = rest.find(Boolean)?.charAt(0).toUpperCase();
  return initial ? `${first} ${initial}.` : first;
}

export function averageRating(ratings: readonly number[]): { average: number; count: number } | null {
  if (!ratings.length) return null;
  return { average: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10, count: ratings.length };
}

// The link the QR and WhatsApp messages carry — always the live site, so a QR printed from any screen works for everyone.
export const REVIEW_PAGE_URL = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.shaadishopping.com'}${REVIEW_PAGE_PATH}`;
