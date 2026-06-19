import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import CategoryModel from '@/lib/models/Category';
import VendorModel from '@/lib/models/Vendor';
import BlogModel from '@/lib/models/Blog';
import { CATEGORIES, VENDORS } from '@/data/seedData';
import { BLOG_POSTS } from '@/data/blogSeedData';
import { requireAdmin } from '@/lib/adminAuth';

export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await connectDB();

    await CategoryModel.deleteMany({});
    await VendorModel.deleteMany({});

    await CategoryModel.insertMany(CATEGORIES);
    await VendorModel.insertMany(VENDORS);

    // Upsert blog posts by slug — never overwrites manually edited posts
    let blogsInserted = 0;
    for (const post of BLOG_POSTS) {
      const exists = await BlogModel.findOne({ slug: post.slug });
      if (!exists) {
        await BlogModel.create({
          ...post,
          publishedAt: post.status === 'published' ? new Date() : null,
        });
        blogsInserted++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${CATEGORIES.length} categories, ${VENDORS.length} vendors, ${blogsInserted} blog posts`,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to seed the database' });
}
