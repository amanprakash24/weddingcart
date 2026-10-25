// Some pictures in the database (service pictures, blog covers) are Unsplash links that Unsplash has since removed:
// they return 404 and the page shows an empty picture. Each dead photo maps to a picture of our own in /public.
// Only the exact dead link is replaced, so a picture changed later in the admin is shown as it is.
// Found by checking every image link in the live database on 25 Oct 2026 (all vendor photos loaded).
const REPLACED: { deadPhoto: string; replacement: string }[] = [
  // Court marriage guide: photo supplied by the founder
  { deadPhoto: 'photo-1521791055366-0d553872952f', replacement: '/images/blog/court-marriage-process-in-india.webp' },
  // Mehndi service picture + mehndi guides: our real photo of a bride's hands with mehndi
  { deadPhoto: 'photo-1591824353446-b4d49d58b8b7', replacement: '/images/hero-bg.jpg' },
  { deadPhoto: 'photo-1596740048408-2b0dda3c6a3d', replacement: '/images/hero-bg.jpg' },
  // DJ service picture + DJ guide: DJ & sangeet stage photo supplied by the founder
  { deadPhoto: 'photo-1571266028243-d220c6a8c270', replacement: '/images/dj-sangeet.jpg' },
  // Bridal jewellery service picture: our bride photo
  { deadPhoto: 'photo-1601121141461-9d6647bef0a1', replacement: '/cat-bridal-fashion.jpg' },
];

export function workingImage(url: string | null | undefined): string {
  const value = url ?? '';
  if (!value.includes('images.unsplash.com/')) return value;
  const hit = REPLACED.find((r) => value.includes(r.deadPhoto));
  return hit ? hit.replacement : value;
}

/** Blog cover images go through the same list. */
export const blogCoverImage = workingImage;
