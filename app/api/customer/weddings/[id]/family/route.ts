import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { Role } from '@/lib/auth/roles';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { asCoupleWedding } from '@/lib/customer/coupleEntry';
import { familyService } from '@/services/family.service';

// GET / POST /api/customer/weddings/[id]/family — the couple's family list, and adding someone to it (23 Nov 2026). The couple only
// ('family' permission); family members themselves get 403. A new sign-in's code is returned ONCE, for the couple to send on WhatsApp.
const body = z.object({ name: z.string().max(200), mobile: z.string().max(30), relation: z.string().max(200).nullish(), role: z.string().max(20) });

async function handleGET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    return NextResponse.json({ success: true, data: await asCoupleWedding(id, session.user.id, () => familyService.list(id), 'family') }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error);
  }
}

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole([Role.CUSTOMER]);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const input = body.parse(await req.json());
    const { id } = await params;
    const userId = session.user.id;
    const data = await asCoupleWedding(id, userId, () => familyService.add(id, input, userId), 'family');
    return NextResponse.json({ success: true, data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = platformScoped(handleGET);
export const POST = platformScoped(handlePOST);
