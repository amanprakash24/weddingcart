import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eventService } from '@/services/event.service';
import { handleApiError } from '@/lib/errors';
import { isRequestRateLimited, recordRequest } from '@/lib/auth/rateLimit';

// Public, unauthenticated POST that creates a real Razorpay payment link on
// every request (external API cost, not just a local write) — unthrottled,
// this is spammable the same way app/api/consultations/route.ts's WhatsApp
// send was (audit finding). Reuses that exact mechanism/namespacing
// convention rather than inventing a new one.
const RATE_LIMIT_PREFIX = 'event-order:';

function clientIp(req: NextRequest): string {
  // Vercel sets x-forwarded-for; first entry is the original client.
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

// customerPhone reuses the /^\d{10}$/ (India, no country code/separators)
// convention already established at app/api/otp/send/route.ts, rather than
// inventing a new phone format. customerEmail reuses the existing
// optional-email-or-empty-string convention from the customer guest routes
// (app/api/customer/weddings/[id]/guests/route.ts) since the public order
// form (components/events/EventPublicClient.tsx) sends '' for a blank email,
// not an omitted field. quantity is capped at 10 here as a hard ceiling
// independent of the pass type's own (nullable) salesLimit, which is
// enforced separately and unchanged in eventService.createOrder.
const schema = z.object({
  customerName: z.string().trim().min(1),
  customerPhone: z.string().regex(/^\d{10}$/, 'Invalid phone number'),
  customerEmail: z.string().trim().email().optional().or(z.literal('')),
  passTypeId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(10).default(1),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimitId = `${RATE_LIMIT_PREFIX}${clientIp(req)}`;
    if (await isRequestRateLimited(rateLimitId)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }
    await recordRequest(rateLimitId);

    const { id } = await params;
    const body = await req.json();
    const parsed = schema.parse(body);

    // paymentProvider/paymentReference are deliberately read from the raw
    // body, unvalidated, unchanged from prior behavior — out of scope for
    // this hardening pass (event.service.ts's payment-confirmation path
    // never trusts either field; real confirmation only ever comes from the
    // signature-verified Razorpay webhook).
    const result = await eventService.createOrder(id, {
      customerName: parsed.customerName,
      customerPhone: parsed.customerPhone,
      customerEmail: parsed.customerEmail || null,
      passTypeId: parsed.passTypeId,
      quantity: parsed.quantity,
      paymentProvider: body.paymentProvider ?? 'RAZORPAY',
      paymentReference: body.paymentReference ?? 'dev-mode',
      notes: parsed.notes ?? null,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
