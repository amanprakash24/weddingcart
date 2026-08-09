import { NextRequest, NextResponse } from 'next/server';
import { blogService } from '@/services/blog.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import type { Blog } from '@/generated/prisma/client';

// Same response shaping as app/api/blogs/route.ts — kept local rather than
// shared, matching how the categories/vendors [id] routes each own their
// response shaping independently.
function toResponseShape(blog: Blog) {
  return {
    ...blog,
    _id: blog.id,
    status: blog.status === 'PUBLISHED' ? 'published' : 'draft',
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const blog = await blogService.getBySlugOrId(slug);
    if (!blog) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ blog: toResponseShape(blog) });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch blog' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { slug } = await params;
    const body = await req.json();

    const data: Parameters<typeof blogService.update>[1] = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.slug !== undefined) data.slug = body.slug;
    if (body.excerpt !== undefined) data.excerpt = body.excerpt;
    if (body.content !== undefined) data.content = body.content;
    if (body.coverImage !== undefined) data.coverImage = body.coverImage;
    if (body.author !== undefined) data.author = body.author;
    if (body.category !== undefined) data.category = body.category;
    if (body.tags !== undefined) data.tags = body.tags;
    if (body.seoTitle !== undefined) data.seoTitle = body.seoTitle;
    if (body.seoDescription !== undefined) data.seoDescription = body.seoDescription;
    if (body.readTime !== undefined) data.readTime = body.readTime;
    if (body.status !== undefined) data.status = body.status === 'published' ? 'PUBLISHED' : 'DRAFT';

    const blog = await blogService.update(slug, data);
    if (!blog) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ blog: toResponseShape(blog) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { slug } = await params;
    await blogService.delete(slug);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
