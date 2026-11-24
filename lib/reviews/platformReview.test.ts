import { describe, expect, test } from 'bun:test';
import { averageRating, checkPlatformReview, isBot, publicName } from './platformReview';

describe('a review of Shaadi Shopping', () => {
  const ok = { authorName: '  Pratik   Anand ', rating: 5, comment: ' Lovely team ', phone: '+91 98765 43210', weddingNumber: 'wed-2026-0002' };
  test('a complete review is cleaned', () => {
    expect(checkPlatformReview(ok)).toEqual({ ok: true, value: { authorName: 'Pratik Anand', rating: 5, comment: 'Lovely team', phone: '9876543210', weddingNumber: 'WED-2026-0002' } });
  });
  test('mobile, wedding ID and comment are optional', () => {
    expect(checkPlatformReview({ authorName: 'Riya', rating: '4' })).toEqual({ ok: true, value: { authorName: 'Riya', rating: 4, comment: null, phone: null, weddingNumber: null } });
  });
  test('name, stars, mobile and wedding ID are checked', () => {
    const err = (x: object) => (checkPlatformReview({ ...ok, ...x }) as { error?: string }).error;
    expect(err({ authorName: 'A' })).toContain('name');
    expect(err({ rating: 0 })).toContain('1 to 5');
    expect(err({ rating: 4.5 })).toContain('1 to 5');
    expect(err({ rating: 'x' })).toContain('1 to 5');
    expect(err({ phone: '12345' })).toContain('10-digit');
    expect(err({ weddingNumber: 'WED-26' })).toContain('WED-2026-0002');
    expect(err({ comment: 'x'.repeat(1001) })).toContain('1000');
  });
  test('the hidden field catches bots', () => {
    expect(isBot({ ...ok, website: 'http://spam' })).toBe(true);
    expect(isBot(ok)).toBe(false);
  });
  test('only first name and an initial are shown', () => {
    expect(publicName('Pratik Anand')).toBe('Pratik A.');
    expect(publicName('Riya')).toBe('Riya');
  });
  test('average of published ratings', () => {
    expect(averageRating([])).toBeNull();
    expect(averageRating([5, 4, 4])).toEqual({ average: 4.3, count: 3 });
  });
});
