import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/mongodb';
import BlogModel from '@/lib/models/Blog';
import { computeAdminToken, computeSuperAdminToken } from '@/lib/adminAuth';

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;
  if (!token) return false;
  return token === computeAdminToken() || token === computeSuperAdminToken();
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(20, parseInt(searchParams.get('limit') ?? '9'));
    const all = searchParams.get('all') === 'true'; // admin: show drafts too

    const query: Record<string, unknown> = all ? {} : { status: 'published' };
    if (category && category !== 'all') query.category = category;

    const total = await BlogModel.countDocuments(query);
    const blogs = await BlogModel.find(query)
      .select('title slug excerpt coverImage author category tags status publishedAt readTime createdAt')
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({ blogs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch blogs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await connectDB();
    const body = await req.json();

    if (!body.title || !body.slug) {
      return NextResponse.json({ error: 'Title and slug are required' }, { status: 400 });
    }

    const existing = await BlogModel.findOne({ slug: body.slug });
    if (existing) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }

    const blog = await BlogModel.create({
      ...body,
      publishedAt: body.status === 'published' ? new Date() : null,
    });

    return NextResponse.json({ blog }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create blog' }, { status: 500 });
  }
}
