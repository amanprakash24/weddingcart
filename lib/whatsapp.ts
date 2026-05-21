const WHATSAPP_API_URL = `https://graph.facebook.com/v22.0`;

export async function sendWhatsAppMessage(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token   = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneId || !token) {
    console.log(`[WhatsApp DEV] To: ${to}\n${body}\n`);
    return { ok: true };
  }

  const res = await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    const msg = err?.error?.message || 'WhatsApp send failed';
    console.error('[WhatsApp error]', msg);
    return { ok: false, error: msg };
  }

  return { ok: true };
}
