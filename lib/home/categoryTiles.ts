// Homepage "Browse by service" tiles, built only from categories that have published vendors, so the
// homepage never offers a service the site cannot show. Pure: the homepage passes in what it loaded.

// Services that have a Patna landing page (app/cities/[city]/[category]); the rest use /categories/<slug>.
const PATNA_PAGES = new Set(['venue', 'makeup', 'mehndi', 'decorator', 'band', 'dj', 'catering', 'photo-video', 'planning']);

// Pictures already in /public (owned files, no outside hosts). A service without one shows a plain tile.
const PICTURES: Record<string, string> = {
  venue: '/cat-venue-guides.jpg',
  decorator: '/cat-decor-flowers.jpg',
  makeup: '/cat-bridal-fashion.jpg',
  'photo-video': '/cat-photography.jpg',
  catering: '/cat-food-catering.jpg',
  security: '/cat-security.jpg', // photo supplied by the founder (25 Oct 2026)
};

// Order couples usually plan in; anything else follows by vendor count.
const ORDER = ['venue', 'catering', 'decorator', 'photo-video', 'makeup', 'mehndi', 'dj', 'band', 'planning'];

export type CategoryTile = { slug: string; name: string; count: number; href: string; picture: string | null };

export function categoryHref(slug: string): string {
  return PATNA_PAGES.has(slug) ? `/cities/patna/${slug}` : `/categories/${slug}`;
}

export function buildCategoryTiles(
  vendorCategorySlugs: string[],
  categories: { slug: string; name: string }[],
  max = 6,
): CategoryTile[] {
  const counts = new Map<string, number>();
  for (const slug of vendorCategorySlugs) {
    if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  const names = new Map(categories.map((c) => [c.slug, c.name]));
  const rank = (slug: string) => {
    const i = ORDER.indexOf(slug);
    return i === -1 ? ORDER.length : i;
  };
  return [...counts.entries()]
    .filter(([slug]) => names.has(slug))
    .sort(([a, ca], [b, cb]) => rank(a) - rank(b) || cb - ca || a.localeCompare(b))
    .slice(0, max)
    .map(([slug, count]) => ({ slug, name: names.get(slug)!, count, href: categoryHref(slug), picture: PICTURES[slug] ?? null }));
}
