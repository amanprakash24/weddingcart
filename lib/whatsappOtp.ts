// Sends a 6-digit one-time code to a mobile on WhatsApp (moved here from app/api/otp/send/route.ts on 28 Oct 2026, so the couple's
// "forgot my code" reset sends it the same way). Meta only delivers free-form text inside a 24h customer-service window, which a
// first-time user never has — so the code goes through an approved AUTHENTICATION template (copy-code button). Name/language must
// match the template approved in WhatsApp Manager.
//
//  - WhatsApp configured → the message is sent.
//  - Not configured, outside production → nothing is sent; the code comes back as `devCode` for local testing.
//  - Not configured in production → a safe error; the code is never exposed.

export type WhatsAppCodeResult = { ok: true; devCode?: string } | { ok: false; status: number; message: string };

export async function sendWhatsAppCode(phone: string, code: string): Promise<WhatsAppCodeResult> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const template = process.env.WHATSAPP_OTP_TEMPLATE;
  const language = process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE || 'en_US';

  if (phoneId && token && template) {
    const res = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: `91${phone}`, // India country code
        type: 'template',
        template: {
          name: template,
          language: { code: language },
          // Authentication templates take the code twice: the body text and the copy-code button.
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
          ],
        },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[WhatsApp OTP error]', JSON.stringify(err));
      return { ok: false, status: 500, message: err?.error?.message || 'Failed to send WhatsApp message' };
    }
    return { ok: true };
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n[OTP DEV] WhatsApp +91 ${phone} — code ${code}\n`);
    return { ok: true, devCode: code };
  }

  console.error('[OTP send] WhatsApp is not configured in production');
  return { ok: false, status: 500, message: 'Unable to send OTP right now. Please try again later.' };
}
