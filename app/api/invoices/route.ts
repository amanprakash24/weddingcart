import { NextRequest, NextResponse } from 'next/server';
import { invoiceService } from '@/services/invoice.service';
import { denyUnlessCompanyFinancials } from '@/lib/auth/companyFinancialsGuard';
import { handleApiError } from '@/lib/errors';
import type { InvoiceWithDetails } from '@/repositories/invoice.repository';
import { findWeddingsForClientPhone, standaloneInvoiceWarning } from '@/services/invoiceWorkflow.service';
import { platformScoped } from '@/lib/ownership/entry';
import { readJsonBody } from '@/lib/readJsonBody';

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

// The Invoices screen lists every invoice in the company with its amounts, so the whole screen (list, read, create, edit,
// delete) is company-financials only (lib/auth/financialAccess.ts). Invoices on a wedding stay in that wedding's Money section.
async function handleGET() {
  const denied = await denyUnlessCompanyFinancials();
  if (denied) return denied;
  try {
    const { data } = await invoiceService.list();
    return NextResponse.json({ success: true, data: data.map(toResponseShape) });
  } catch (err) {
    console.error('GET /api/invoices failed:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

async function handlePOST(req: NextRequest) {
  const denied = await denyUnlessCompanyFinancials();
  if (denied) return denied;
  try {
    const body = await readJsonBody(req);
    const {
      clientName, clientPhone, clientEmail, clientCity, eventDate, eventType,
      subtotal, discount, gstEnabled, gstAmount, total, amountPaid, notes, items,
    } = body;

    // The old Invoices screen makes STANDALONE invoices (no wedding). If this customer already has a wedding, the right place is
    // that wedding's Money section — so ask before creating a second, unconnected invoice.
    if (body.confirmStandalone !== true) {
      const weddings = await findWeddingsForClientPhone(String(clientPhone ?? ''));
      if (weddings.length > 0) {
        return NextResponse.json(
          { success: false, code: 'HAS_WEDDING', error: standaloneInvoiceWarning(weddings), weddings },
          { status: 409 }
        );
      }
    }

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

// Record ownership: this route works as Shaadi Shopping (lib/ownership/entry.ts).
export const GET = platformScoped(handleGET);
export const POST = platformScoped(handlePOST);
