import { NextRequest, NextResponse } from 'next/server';
import { blogService } from '@/services/blog.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import type { Blog } from '@/generated/prisma/client';

// Admin/public callers still expect the legacy Mongo shape: lowercase
// 'draft'/'published' (Prisma's BlogStatus enum is uppercase) and an `_id`
// field (Prisma's is `id`). Shaping happens here at the route boundary, not
// in the repository/service, which stay truthful to the Prisma model.
function toResponseShape(blog: Blog) {
  return {
    ...blog,
    _id: blog.id,
    status: blog.status === 'PUBLISHED' ? 'published' : 'draft',
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(20, parseInt(searchParams.get('limit') ?? '9'));
    const includeUnpublished = searchParams.get('all') === 'true' && (await requireAdmin());

    const { data, total } = await blogService.list({
      category: category ?? undefined,
      includeUnpublished,
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      blogs: data.map(toResponseShape),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch blogs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    if (!body.title || !body.slug) {
      return NextResponse.json({ error: 'Title and slug are required' }, { status: 400 });
    }

    const blog = await blogService.create({
      title: body.title,
      slug: body.slug,
      excerpt: body.excerpt ?? '',
      content: body.content ?? '',
      coverImage: body.coverImage ?? '',
      author: body.author ?? 'ShaadiShopping Team',
      category: body.category ?? 'Wedding Tips',
      tags: body.tags ?? [],
      seoTitle: body.seoTitle ?? '',
      seoDescription: body.seoDescription ?? '',
      status: body.status === 'published' ? 'PUBLISHED' : 'DRAFT',
      readTime: body.readTime ?? 1,
    });

    return NextResponse.json({ blog: toResponseShape(blog) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
