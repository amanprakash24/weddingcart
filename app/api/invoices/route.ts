import { NextRequest, NextResponse } from 'next/server';
import { invoiceService } from '@/services/invoice.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import type { InvoiceWithDetails } from '@/repositories/invoice.repository';

// Admin UI still expects the legacy Mongo shape: lowercase status
// ('draft'/'sent'/'paid', Prisma's InvoiceStatus enum is uppercase) and an
// `_id` field (Prisma's is `id`). `weddingId`/`payments`/`paymentLinks` are
// Phase B Finance additions the legacy admin UI has never seen and doesn't
// use — stripped here to keep the response shape matching what it always
// was under Mongo. Shaping happens at the route boundary, not in the
// repository/service.
function toResponseShape(invoice: InvoiceWithDetails) {
  const { weddingId: _weddingId, payments: _payments, paymentLinks: _paymentLinks, ...rest } = invoice;
  return { ...rest, _id: invoice.id, status: invoice.status.toLowerCase() };
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { data } = await invoiceService.list();
    return NextResponse.json({ success: true, data: data.map(toResponseShape) });
  } catch (err) {
    console.error('GET /api/invoices failed:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const {
      clientName, clientPhone, clientEmail, clientCity, eventDate, eventType,
      subtotal, discount, gstEnabled, gstAmount, total, amountPaid, notes, items,
    } = body;

    const invoice = await invoiceService.create({
      clientName, clientPhone, clientEmail, clientCity, eventDate, eventType,
      subtotal, discount, gstEnabled, gstAmount, total, amountPaid, notes,
      items: Array.isArray(items)
        ? items.map((i) => ({ description: i.description, vendorName: i.vendorName, amount: i.amount, quantity: i.quantity }))
        : [],
    });

    return NextResponse.json({ success: true, data: toResponseShape(invoice) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
