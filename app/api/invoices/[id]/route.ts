import { NextRequest, NextResponse } from 'next/server';
import { invoiceService } from '@/services/invoice.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import type { InvoiceWithDetails } from '@/repositories/invoice.repository';
import type { Prisma, InvoiceStatus } from '@/generated/prisma/client';

function toResponseShape(invoice: InvoiceWithDetails) {
  const { weddingId: _weddingId, payments: _payments, paymentLinks: _paymentLinks, ...rest } = invoice;
  return { ...rest, _id: invoice.id, status: invoice.status.toLowerCase() };
}

function toInvoiceStatus(status: unknown): InvoiceStatus | undefined {
  if (status === 'draft') return 'DRAFT';
  if (status === 'sent') return 'SENT';
  if (status === 'paid') return 'PAID';
  return undefined;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const invoice = await invoiceService.getById(id);
    if (!invoice) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: toResponseShape(invoice) });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch invoice' }, { status: 500 });
  }
}

// PUT serves two different callers: the full edit form (every field +
// items resubmitted) and a quick status-only button ({status} alone) — both
// handled here via conditional field inclusion, so a status-only PUT never
// touches the other fields. invoiceNumber is never accepted from the body —
// system-generated, matches the original route's explicit protection
// (`const { invoiceNumber: _removed, ...safeUpdate } = body`).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json();

    const data: Prisma.InvoiceUpdateInput = {};
    if (body.clientName !== undefined) data.clientName = body.clientName;
    if (body.clientPhone !== undefined) data.clientPhone = body.clientPhone;
    if (body.clientEmail !== undefined) data.clientEmail = body.clientEmail;
    if (body.clientCity !== undefined) data.clientCity = body.clientCity;
    if (body.eventDate !== undefined) data.eventDate = body.eventDate;
    if (body.eventType !== undefined) data.eventType = body.eventType;
    if (body.subtotal !== undefined) data.subtotal = body.subtotal;
    if (body.discount !== undefined) data.discount = body.discount;
    if (body.gstEnabled !== undefined) data.gstEnabled = body.gstEnabled;
    if (body.gstAmount !== undefined) data.gstAmount = body.gstAmount;
    if (body.total !== undefined) data.total = body.total;
    if (body.amountPaid !== undefined) data.amountPaid = body.amountPaid;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.status !== undefined) {
      const status = toInvoiceStatus(body.status);
      if (!status) {
        return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
      }
      data.status = status;
    }

    const items = Array.isArray(body.items)
      ? body.items.map((i: { description: string; vendorName?: string; amount: number; quantity?: number }) => ({
          description: i.description,
          vendorName: i.vendorName,
          amount: i.amount,
          quantity: i.quantity,
        }))
      : undefined;

    const invoice = await invoiceService.update(id, data, items);
    if (!invoice) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: toResponseShape(invoice) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    await invoiceService.delete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
