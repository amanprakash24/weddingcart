/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test';
import { readJsonBody } from './readJsonBody';
import { handleApiError, ValidationError, USER_MESSAGES } from './errors';
import { createCategoryBody, updateCategoryBody } from './categories/categorySchema';

const post = (body?: string) => new Request('http://local/api/x', { method: 'POST', body });

describe('readJsonBody', () => {
  test('reads a JSON object', async () => {
    expect(await readJsonBody(post('{"a":1}'))).toEqual({ a: 1 });
  });

  test('reads arrays and other JSON values as they are', async () => {
    expect(await readJsonBody(post('[1,2]'))).toEqual([1, 2]);
    expect(await readJsonBody(post('null'))).toBeNull();
  });

  for (const [label, body] of [
    ['no body', undefined],
    ['empty body', ''],
    ['only spaces', '   \n'],
    ['not JSON', 'not json'],
    ['cut-off JSON', '{"a":'],
  ] as const) {
    test(`${label} is the caller's mistake: a 400, not a 500`, async () => {
      const err = await readJsonBody(post(body)).catch((e) => e);
      expect(err).toBeInstanceOf(ValidationError);
      const res = handleApiError(err);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe(USER_MESSAGES.invalid);
    });
  }
});

describe('category bodies', () => {
  test('the admin form sends the slug as `id` — accepted', () => {
    const body = createCategoryBody.parse({ id: 'trousseau', name: 'Trousseau', icon: '🎁', description: '', image: '', vendorCount: 0 });
    expect(body.slug).toBe('trousseau');
    expect(body).not.toHaveProperty('vendorCount');
  });

  test('`slug` wins over `id`', () => {
    expect(createCategoryBody.parse({ slug: 'venue', id: 'other', name: 'Venue' }).slug).toBe('venue');
  });

  test('missing name or slug, or wrong types, are refused', () => {
    expect(createCategoryBody.safeParse({}).success).toBe(false);
    expect(createCategoryBody.safeParse({ slug: 'venue' }).success).toBe(false);
    expect(createCategoryBody.safeParse({ slug: 'Venue Halls', name: 'x' }).success).toBe(false);
    expect(createCategoryBody.safeParse({ slug: 'venue', name: 5 }).success).toBe(false);
    expect(createCategoryBody.safeParse({ slug: 'venue', name: 'Venue', isSpecial: 'yes' }).success).toBe(false);
    expect(createCategoryBody.safeParse(null).success).toBe(false);
  });

  test('an edit may change any one field, never the slug', () => {
    expect(updateCategoryBody.parse({ name: 'Venues' })).toEqual({ name: 'Venues' });
    expect(updateCategoryBody.parse({ id: 'x', slug: 'y', isSpecial: true })).toEqual({ isSpecial: true });
    expect(updateCategoryBody.safeParse({ name: 7 }).success).toBe(false);
  });
});

describe('the database refusing the shape of a value', () => {
  test('is a 400 with the "please check" words, not a 500', async () => {
    const { Prisma } = await import('@/generated/prisma/client');
    const err = new Prisma.PrismaClientValidationError('Invalid value for argument `date`: Provided Date object is invalid.', {
      clientVersion: 'test',
    });
    const res = handleApiError(err);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(USER_MESSAGES.invalid);
  });
});
