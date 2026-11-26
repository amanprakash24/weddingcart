import { NextRequest, NextResponse } from 'next/server';
import { categoryService } from '@/services/category.service';
import { requireAdmin } from '@/lib/adminAuth';
import { platformScoped } from '@/lib/ownership/entry';
import { workingImage } from '@/lib/images/workingImage';
import { handleApiError } from '@/lib/errors';
import { readJsonBody } from '@/lib/readJsonBody';
import { createCategoryBody } from '@/lib/categories/categorySchema';

async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('options') === 'true') {
      const data = await categoryService.listOptions();
      return NextResponse.json({ success: true, data });
    }

    const isSpecialParam = searchParams.get('isSpecial');
    const isSpecial =
      isSpecialParam === 'true' ? true : isSpecialParam === 'false' ? false : undefined;

    const { data } = await categoryService.list({ isSpecial });
    // Removed Unsplash pictures → our own (lib/images/workingImage.ts)
    return NextResponse.json({ success: true, data: data.map((c) => ({ ...c, image: workingImage(c.image) })) });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = createCategoryBody.parse(await readJsonBody(req));

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
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const POST = platformScoped(handlePOST);
