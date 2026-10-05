import { NextRequest, NextResponse } from 'next/server';
import { categoryService } from '@/services/category.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';

async function handleGET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const category = await categoryService.getById(id);
    if (!category) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: category });
  } catch (err) {
    console.error('GET /api/categories/[id] failed:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch category' },
      { status: 500 }
    );
  }
}

async function handlePUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const category = await categoryService.update(id, {
      name: body.name,
      icon: body.icon,
      description: body.description,
      image: body.image,
      isSpecial: body.isSpecial,
    });

    return NextResponse.json({ success: true, data: category });
  } catch (err) {
    return handleApiError(err);
  }
}

async function handleDELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    await categoryService.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const PUT = platformScoped(handlePUT);
export const DELETE = platformScoped(handleDELETE);
