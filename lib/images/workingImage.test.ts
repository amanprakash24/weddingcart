/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { workingImage, blogCoverImage } from './workingImage';

const publicFile = (p: string) => existsSync(join(import.meta.dir, '..', '..', 'public', p));

describe('workingImage', () => {
  const dead = {
    court: 'https://images.unsplash.com/photo-1521791055366-0d553872952f?w=1200&q=80',
    mehndi: 'https://images.unsplash.com/photo-1591824353446-b4d49d58b8b7?w=800&q=80',
    mehndiGuide: 'https://images.unsplash.com/photo-1596740048408-2b0dda3c6a3d?w=1200&q=80',
    dj: 'https://images.unsplash.com/photo-1571266028243-d220c6a8c270?w=1920&q=80',
    jewellery: 'https://images.unsplash.com/photo-1601121141461-9d6647bef0a1?w=800&q=80',
  };

  test('every removed Unsplash photo becomes one of our own pictures, and that file exists', () => {
    expect(blogCoverImage(dead.court)).toBe('/images/blog/court-marriage-process-in-india.webp');
    expect(workingImage(dead.mehndi)).toBe('/images/hero-bg.jpg');
    expect(workingImage(dead.mehndiGuide)).toBe('/images/hero-bg.jpg');
    expect(workingImage(dead.dj)).toBe('/images/dj-sangeet.jpg');
    expect(workingImage(dead.jewellery)).toBe('/cat-bridal-fashion.jpg');
    for (const u of Object.values(dead)) expect(publicFile(workingImage(u))).toBe(true);
  });

  test('everything else is left as it is', () => {
    const live = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=80';
    expect(workingImage(live)).toBe(live);
    expect(workingImage('https://res.cloudinary.com/x/image/upload/photo-1521791055366-0d553872952f.jpg')).toContain('cloudinary');
    expect(workingImage('/images/blog/other.jpg')).toBe('/images/blog/other.jpg');
    expect(workingImage(null)).toBe('');
  });
});
