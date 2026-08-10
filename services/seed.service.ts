import { blogRepository } from '@/repositories/blog.repository';
import { blogService } from '@/services/blog.service';
import { BLOG_POSTS } from '@/data/blogSeedData';

// Non-destructive only — upserts blog posts by slug, never overwrites or
// deletes existing ones. The old Mongo route also wiped and reseeded
// Category/Vendor from data/seedData.ts; that is deliberately NOT ported.
// Postgres has real foreign-key constraints Mongo never had: Enquiry.vendor,
// VendorBooking.vendor, and Payout.vendor are all required, non-cascading
// relations, so a bulk vendor delete would fail (or need a much larger,
// unauthorized cascade) the moment any real dependent data exists — which it
// now does. Separately, data/seedData.ts is a stale early-dev snapshot
// (stock photos, placeholder content) sharing slugs with real vendors that
// have since been updated with real content — restoring it would regress
// real data, not just add fake data. See
// docs/database/postgres-migration-plan.md's seed lockdown decision.
export const seedService = {
  async seedBlogs(): Promise<number> {
    let blogsInserted = 0;
    for (const post of BLOG_POSTS) {
      const exists = await blogRepository.findBySlug(post.slug);
      if (!exists) {
        await blogService.create({
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          coverImage: post.coverImage,
          author: post.author,
          category: post.category,
          tags: post.tags,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          status: post.status === 'published' ? 'PUBLISHED' : 'DRAFT',
          readTime: post.readTime,
        });
        blogsInserted++;
      }
    }
    return blogsInserted;
  },
};
