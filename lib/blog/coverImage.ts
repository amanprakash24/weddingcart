// Some blog covers were stored as Unsplash links that Unsplash has since removed (they now return 404, so the guide
// shows an empty picture). Each dead link maps to our own copy in /public. Only the exact dead link is replaced:
// a cover changed later in the admin is shown as it is.
const REPLACED_COVERS: { deadPhoto: string; replacement: string }[] = [
  // Court marriage guide; photo supplied by the founder (25 Oct 2026)
  { deadPhoto: 'images.unsplash.com/photo-1521791055366-0d553872952f', replacement: '/images/blog/court-marriage-process-in-india.webp' },
];

export function blogCoverImage(coverImage: string | null | undefined): string {
  const cover = coverImage ?? '';
  const hit = REPLACED_COVERS.find((r) => cover.includes(r.deadPhoto));
  return hit ? hit.replacement : cover;
}
