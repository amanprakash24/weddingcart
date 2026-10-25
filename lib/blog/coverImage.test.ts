/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { blogCoverImage } from './coverImage';

describe('blogCoverImage', () => {
  test('replaces the removed Unsplash court marriage photo with our own copy, which exists', () => {
    const out = blogCoverImage('https://images.unsplash.com/photo-1521791055366-0d553872952f?w=1200&q=80');
    expect(out).toBe('/images/blog/court-marriage-process-in-india.webp');
    expect(existsSync(join(import.meta.dir, '..', '..', 'public', out))).toBe(true);
  });

  test('leaves every other cover as it is', () => {
    expect(blogCoverImage('https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=80')).toBe(
      'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=80',
    );
    expect(blogCoverImage('/images/blog/other.jpg')).toBe('/images/blog/other.jpg');
    expect(blogCoverImage(null)).toBe('');
  });
});
