// Roadmap 1.4 (08-quotation.md §21) — how couples' reviews are shown. Dependency-free, so public pages and the proposal page can
// import it. Verified reviews are NEVER blended with Vendor.rating / reviewCount (the hand-entered "online rating").

// The label for the hand-entered numbers already on vendor pages. Kept in one place: change it to "Google rating" only if that is
// where the numbers came from.
export const ONLINE_RATING_LABEL = 'Online rating';
export const VERIFIED_REVIEWS_LABEL = 'Reviews from Shaadi Shopping couples';

export interface PublicReview {
  authorName: string;
  rating: number;
  comment: string | null;
  date: string; // when it was sent
}

// Average to one decimal, over PUBLISHED reviews only (the caller passes only those).
export function reviewSummary(ratings: number[]): { average: number; count: number } | null {
  const valid = ratings.filter((r) => Number.isInteger(r) && r >= 1 && r <= 5);
  if (valid.length === 0) return null;
  return { average: Math.round((valid.reduce((s, r) => s + r, 0) / valid.length) * 10) / 10, count: valid.length };
}

export function toPublicReview(r: { authorName: string; rating: number; comment: string | null; createdAt: Date | string }): PublicReview {
  return { authorName: r.authorName, rating: r.rating, comment: r.comment, date: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString() };
}

export const RATING_WORDS: Record<number, string> = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent' };

// What the couple sees on their proposal link once the wedding is completed: each vendor they booked, and their own review of it.
export interface ProposalReviews {
  items: {
    bookingId: string; // the vendor booking (the key the couple sends back — checked server-side against their wedding)
    vendorName: string;
    category: string;
    functionLabel: string;
    review: { rating: number; comment: string | null; authorName: string; status: 'PENDING' | 'PUBLISHED' | 'HIDDEN' } | null;
  }[];
  defaultName: string; // the couple's name, offered as the name to show
}
