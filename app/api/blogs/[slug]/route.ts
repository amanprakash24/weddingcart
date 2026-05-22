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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    await connectDB();
    // Allow fetching by slug OR by MongoDB _id (for admin edit)
    const blog = await BlogModel.findOne({
      $or: [{ slug }, { _id: slug.length === 24 ? slug : undefined }],
    }).lean();
    if (!blog) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ blog });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch blog' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { slug } = await params;
  try {
    await connectDB();
    const body = await req.json();

    // If publishing for the first time, set publishedAt
    if (body.status === 'published' && !body.publishedAt) {
      body.publishedAt = new Date();
    }

    const blog = await BlogModel.findOneAndUpdate(
      { $or: [{ slug }, { _id: slug.length === 24 ? slug : undefined }] },
      { $set: body },
      { new: true },
    ).lean();

    if (!blog) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ blog });
  } catch {
    return NextResponse.json({ error: 'Failed to update blog' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { slug } = await params;
  try {
    await connectDB();
    await BlogModel.findOneAndDelete({
      $or: [{ slug }, { _id: slug.length === 24 ? slug : undefined }],
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete blog' }, { status: 500 });
  }
}
