import { NextRequest, NextResponse } from 'next/server';
import { moneyGuard } from '@/lib/auth/moneyGuard';
import { z } from 'zod';
import { weddingWorkspaceService } from '@/services/weddingWorkspace.service';
import { handleApiError } from '@/lib/errors';
import { platformScoped } from '@/lib/ownership/entry';
import { readJsonBody } from '@/lib/readJsonBody';

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

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await moneyGuard({ wedding: id }, 'full');
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;
  try {
    const body = bodySchema.parse(await readJsonBody(req));
    const invoice = await weddingWorkspaceService.createInvoice(id, body, session.user.id ?? null);
    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const POST = platformScoped(handlePOST);
