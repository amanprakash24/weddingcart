// Roadmap 1.4 — what a couple may send as a review. Server-side (ValidationError lives in lib/errors).
import { ValidationError } from '@/lib/errors';

export const COMMENT_MAX = 1000;
export const NAME_MAX = 60;

export interface ReviewInput {
  rating: number;
  comment: string | null;
  authorName: string;
}

export function validateReview(input: { rating: unknown; comment?: unknown; authorName?: unknown }): ReviewInput {
  const rating = typeof input.rating === 'number' ? input.rating : Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ValidationError('Choose a rating from 1 to 5 stars');
  const comment = typeof input.comment === 'string' ? input.comment.trim() : '';
  if (comment.length > COMMENT_MAX) throw new ValidationError(`Please keep your review under ${COMMENT_MAX} characters`);
  const authorName = typeof input.authorName === 'string' ? input.authorName.trim().replace(/\s+/g, ' ') : '';
  if (authorName.length < 2) throw new ValidationError('Enter the name to show with your review');
  if (authorName.length > NAME_MAX) throw new ValidationError(`Please keep the name under ${NAME_MAX} characters`);
  // A review is about the service — links and phone numbers are not allowed on a public page.
  if (/https?:\/\/|www\.|\b\d{10}\b/i.test(`${comment} ${authorName}`)) throw new ValidationError('Please leave out links and phone numbers');
  return { rating, comment: comment || null, authorName };
}

// A booking the couple may review: one they really had, on a wedding that is completed.
export const REVIEWABLE_BOOKING = ['CONFIRMED', 'COMPLETED'] as const;
