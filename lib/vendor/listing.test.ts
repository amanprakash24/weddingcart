import { describe, expect, test } from 'bun:test';
import { descriptionBlocks, listingPhotos, plainDescription, startingPrice } from './listing';

describe('listing photos', () => {
  test('the vendor’s uploaded photos are used, first one as the cover', () => {
    expect(listingPhotos('', ['a.jpg', 'b.jpg', 'c.jpg'], 'stock.jpg')).toEqual({ image: 'a.jpg', images: ['a.jpg', 'b.jpg', 'c.jpg'] });
  });
  test('a chosen cover comes first and nothing repeats', () => {
    expect(listingPhotos('b.jpg', ['a.jpg', 'b.jpg'], 'stock.jpg')).toEqual({ image: 'b.jpg', images: ['b.jpg', 'a.jpg'] });
  });
  test('the fallback is only for a registration with no photo at all', () => {
    expect(listingPhotos('', [' '], 'stock.jpg')).toEqual({ image: 'stock.jpg', images: ['stock.jpg'] });
  });
});

describe('starting price', () => {
  test('no packages: the vendor’s own price, never infinity', () => expect(startingPrice(25000, [], false)).toBe(25000));
  test('packages: the lowest', () => expect(startingPrice(25000, [40000, 30000], false)).toBe(30000));
  test('per plate: the vendor’s price', () => expect(startingPrice(800, [40000], true)).toBe(800));
});

describe('description', () => {
  const text = 'We decorate weddings.\n\n**Why Choose Us?**\nCreative **designs** for you.';
  test('bold lines become headings and stars are never shown', () => {
    expect(descriptionBlocks(text)).toEqual([
      { kind: 'paragraph', text: 'We decorate weddings.' },
      { kind: 'heading', text: 'Why Choose Us?' },
      { kind: 'paragraph', text: 'Creative designs for you.' },
    ]);
  });
  test('plain text for search has no stars', () => expect(plainDescription(text)).toBe('We decorate weddings. Why Choose Us? Creative designs for you.'));
});
