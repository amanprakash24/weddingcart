import { NextRequest, NextResponse } from 'next/server';
import { vendorApplicationService } from '@/services/vendorApplication.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import type { VendorApplicationWithCategory } from '@/repositories/vendorApplication.repository';
import type { ApplicationStatus } from '@/generated/prisma/client';
import { platformScoped } from '@/lib/ownership/entry';

function toResponseShape(app: VendorApplicationWithCategory) {
  const { category, ...rest } = app;
  return { ...rest, _id: app.id, category: category.name, status: app.status.toLowerCase() };
}

function toApplicationStatus(status: unknown): ApplicationStatus | undefined {
  if (status === 'new') return 'NEW';
  if (status === 'approved') return 'APPROVED';
  if (status === 'rejected') return 'REJECTED';
  return undefined;
}

async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const application = await vendorApplicationService.getById(id);
    if (!application) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: toResponseShape(application) });
  } catch (err) {
    console.error('GET /api/vendor-applications/[id] failed:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch application' }, { status: 500 });
  }
}

async function handlePUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const status = toApplicationStatus(body.status);
    if (!status) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    const result = await vendorApplicationService.updateStatus(id, status);
    if (!result) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    // On the first approval the vendor's login code comes back once, beside the application — never inside it, never stored.
    const { issuedLoginCode, existingLogin, ...application } = result;
    return NextResponse.json(
      { success: true, data: toResponseShape(application), ...(issuedLoginCode ? { loginCode: issuedLoginCode } : {}), ...(existingLogin ? { existingLogin: true } : {}) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return handleApiError(err);
  }
}

async function handleDELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    await vendorApplicationService.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const PUT = platformScoped(handlePUT);
export const DELETE = platformScoped(handleDELETE);
