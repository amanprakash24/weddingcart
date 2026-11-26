import { z } from 'zod';

// What staff may send when adding or editing a category (/api/categories, /api/categories/[id]). Anything else — a missing
// name, a number where words belong — is a 400 with the usual "please check" words, not a 500.
const text = z.string().trim();

const categoryFields = z.object({
  slug: text.min(1).max(80).regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and dashes'),
  name: text.min(1).max(120),
  icon: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  image: z.string().max(2000).optional(),
  isSpecial: z.boolean().optional(),
});

// The admin form (components/AdminClient.tsx) sends the slug as `id` ("Category ID"); before this check the route read only
// `slug`, so adding a category from that form always failed. Both names are accepted; `slug` wins.
export const createCategoryBody = z.preprocess(
  (body) =>
    body && typeof body === 'object' && !Array.isArray(body) && (body as { slug?: unknown }).slug === undefined
      ? { ...body, slug: (body as { id?: unknown }).id }
      : body,
  categoryFields
);

export const updateCategoryBody = categoryFields.omit({ slug: true }).partial();
