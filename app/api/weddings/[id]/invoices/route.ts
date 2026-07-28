import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';

// No GET — invoices ride the existing aggregate GET /api/weddings/[id]/workspace,
// same "one Workspace Loader" rule as vendor-bookings.

const itemSchema = z.object({
  description: z.string().trim().min(1),
  vendorName: z.string().trim().min(1).optional(),
  amount: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
});

const bodySchema = z.object({
  clientName: z.string().trim().min(1),
  clientPhone: z.string().trim().min(1),
  clientEmail: z.string().trim().email().optional(),
  clientCity: z.string().trim().min(1).optional(),
  eventDate: z.string().trim().optional(),
  eventType: z.string().trim().optional(),
  gstEnabled: z.boolean().default(true),
  gstAmount: z.number().int().min(0).default(0),
  discount: z.number().int().min(0).default(0),
  notes: z.string().trim().optional(),
  items: z.array(itemSchema).min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(ADMIN_ROLES);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = bodySchema.parse(await req.json());
    const invoice = await weddingWorkspaceService.createInvoice(id, body, session.user.id ?? null);
    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
