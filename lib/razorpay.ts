import crypto from 'crypto';

const RAZORPAY_API_URL = 'https://api.razorpay.com/v1';

export async function createPaymentLink(input: {
  invoiceId: string;
  amount: number; // paise
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  description: string;
}): Promise<{ ok: true; razorpayPaymentLinkId: string; shortUrl: string } | { ok: false; error: string }> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.log(`[Razorpay DEV] Payment link for invoice ${input.invoiceId}, amount ${input.amount}\n`);
    return { ok: true, razorpayPaymentLinkId: `dev_${input.invoiceId}`, shortUrl: 'https://rzp.io/dev-mode' };
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const res = await fetch(`${RAZORPAY_API_URL}/payment_links`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: 'INR',
      description: input.description,
      customer: {
        name: input.clientName,
        contact: input.clientPhone,
        email: input.clientEmail,
      },
      notify: { sms: true, email: !!input.clientEmail },
      reminder_enable: true,
      // Lets the webhook correlate a paid link back to an Invoice without a
      // separate order-tracking table — Razorpay copies these notes onto the
      // payment entity in webhook payloads too.
      notes: { invoiceId: input.invoiceId },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    const msg = err?.error?.description || 'Razorpay payment link creation failed';
    console.error('[Razorpay error]', msg);
    return { ok: false, error: msg };
  }

  const data = await res.json();
  return { ok: true, razorpayPaymentLinkId: data.id, shortUrl: data.short_url };
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
