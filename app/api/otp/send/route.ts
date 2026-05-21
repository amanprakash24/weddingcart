import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import OTP from '@/lib/models/OTP';

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone || !/^\d{10}$/.test(phone)) {
      return NextResponse.json({ success: false, message: 'Invalid phone number' }, { status: 400 });
    }

    await connectDB();

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await OTP.deleteMany({ phone });
    await OTP.create({ phone, code });

    const phoneId    = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token      = process.env.WHATSAPP_ACCESS_TOKEN;

    if (phoneId && token) {
      const res = await fetch(
        `https://graph.facebook.com/v22.0/${phoneId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: `91${phone}`,           // India country code
            type: 'text',
            text: {
              body:
                `🔐 *WeddingCart Verification*\n\n` +
                `Your OTP is: *${code}*\n\n` +
                `Valid for 5 minutes. Do not share this code with anyone.\n\n` +
                `_— WeddingCart Team_ 💍`,
            },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        console.error('[WhatsApp OTP error]', JSON.stringify(err));
        return NextResponse.json(
          { success: false, message: err?.error?.message || 'Failed to send WhatsApp message' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    } else {
      // Dev mode — WhatsApp not configured, return code in response for testing
      console.log(`\n[OTP DEV] ─────────────────────────────`);
      console.log(`  WhatsApp : +91 ${phone}`);
      console.log(`  Code     : ${code}`);
      console.log(`────────────────────────────────────────\n`);
      return NextResponse.json({ success: true, devCode: code });
    }
  } catch (err) {
    console.error('[OTP send]', err);
    return NextResponse.json({ success: false, message: 'Failed to send OTP' }, { status: 500 });
  }
}
