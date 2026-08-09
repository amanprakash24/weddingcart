import { NextRequest, NextResponse } from 'next/server';
import { categoryService } from '@/services/category.service';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const isSpecialParam = searchParams.get('isSpecial');
    const isSpecial =
      isSpecialParam === 'true' ? true : isSpecialParam === 'false' ? false : undefined;

    const { data } = await categoryService.list({ isSpecial });

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    const category = await categoryService.create({
      slug: body.slug,
      name: body.name,
      icon: body.icon ?? '',
      description: body.description ?? '',
      image: body.image ?? '',
      isSpecial: body.isSpecial ?? false,
    });

    return NextResponse.json(
      { success: true, data: category },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to create category' },
      { status: 500 }
    );
  }
}
