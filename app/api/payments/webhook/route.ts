import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { paymentService } from '@/services/payment.service';

// Razorpay calls this directly — no session, no requireRole. Trust comes
// entirely from the HMAC-SHA256 signature over the raw request body, so the
// raw text must be read (and verified) before any JSON parsing or DB access.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature');

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 400 });
  }

  try {
    const payload = JSON.parse(rawBody);
    await paymentService.handleWebhookEvent(payload);
    // Always 200 once the signature is valid and processing didn't throw —
    // including for event types we intentionally ignore, so Razorpay doesn't
    // keep retrying those. A thrown error below returns 500 so Razorpay does
    // retry genuine processing failures.
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[Razorpay webhook error]', err);
    return NextResponse.json({ success: false, error: 'Webhook processing failed' }, { status: 500 });
  }
}
