import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import BookingModel from '@/lib/models/Booking';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { requireAdmin } from '@/lib/adminAuth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const { status } = await req.json();

    const existing = await BookingModel.findById(id).lean() as {
      name: string;
      phone: string;
      city: string;
      total: number;
      items: { vendorName: string; packageName: string; price: number; quantity: number }[];
      status: string;
    } | null;

    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const booking = await BookingModel.findByIdAndUpdate(id, { status }, { new: true });

    if (status === 'contacted' && existing.status !== 'contacted') {
      const itemLines = (existing.items || [])
        .map((it) => `• ${it.vendorName} — ${it.packageName}: ₹${(it.price * it.quantity).toLocaleString('en-IN')}`)
        .join('\n');

      const message = `Hello ${existing.name}! 🌸

Thank you for choosing ShaadiShopping for your wedding planning.

Our team has reviewed your booking request and will be reaching out to you shortly to confirm all details.

*Your Booking Summary:*
${itemLines}

*Total: ₹${existing.total?.toLocaleString('en-IN')}*
📍 City: ${existing.city}

We look forward to making your special day truly memorable! ✨

— Team ShaadiShopping`;

      const phone = existing.phone.replace(/\D/g, '');
      const e164 = phone.startsWith('91') ? phone : `91${phone}`;
      await sendWhatsAppMessage(e164, message);
    }

    return NextResponse.json({ success: true, data: booking });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update booking' }, { status: 500 });
  }
}
