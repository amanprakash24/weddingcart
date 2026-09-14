import { NextRequest, NextResponse } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { convertBookingToWedding, InvalidBookingStateError } from '@/services/weddingConversion.service';
import { requireAdmin } from '@/lib/adminAuth';
import { handleApiError } from '@/lib/errors';
import type { Booking, BookingStatus } from '@/generated/prisma/client';

function toResponseShape<T extends Pick<Booking, 'id' | 'status'>>(booking: T) {
  return { ...booking, _id: booking.id, status: booking.status.toLowerCase() };
}

function toBookingStatus(status: unknown): BookingStatus | undefined {
  if (status === 'new') return 'NEW';
  if (status === 'contacted') return 'CONTACTED';
  if (status === 'confirmed') return 'CONFIRMED';
  if (status === 'closed') return 'CLOSED';
  return undefined;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const status = toBookingStatus(body.status);
    if (!status) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    const existing = await bookingService.getById(id);
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const booking = await bookingService.update(id, { status });

    // Only fire on an actual transition into CONTACTED — using the
    // pre-update `existing` fetched above, matching the original Mongo
    // route's guard exactly, so re-saving an already-contacted booking never
    // re-sends the message.
    if (status === 'CONTACTED' && existing.status !== 'CONTACTED') {
      const itemLines = existing.items
        .map((it) => `• ${it.vendorName} — ${it.packageName}: ₹${(it.price * it.quantity).toLocaleString('en-IN')}`)
        .join('\n');

      const message = `Hello ${existing.name}! 🌸

Thank you for choosing ShaadiShopping for your wedding planning.

Our team has reviewed your booking request and will be reaching out to you shortly to confirm all details.

*Your Booking Summary:*
${itemLines}

*Total: ₹${existing.total.toLocaleString('en-IN')}*
📍 City: ${existing.city}

We look forward to making your special day truly memorable! ✨

— Team ShaadiShopping`;

      const phone = existing.phone.replace(/\D/g, '');
      const e164 = phone.startsWith('91') ? phone : `91${phone}`;
      await sendWhatsAppMessage(e164, message);
    }

    // Deliberately NOT gated on "existing.status !== 'CONFIRMED'" (unlike
    // the CONTACTED/WhatsApp block above) — that guard would make a failed
    // conversion permanently unrecoverable: once the first attempt sets
    // status to CONFIRMED, a retry would never see a fresh transition and
    // conversion would never be re-attempted. Instead, every PUT that
    // targets CONFIRMED attempts conversion; convertBookingToWedding
    // (services/weddingConversion.service.ts) is itself idempotent (checks
    // Wedding.sourceBookingId first) and cheap to re-run once a Wedding
    // already exists, so this is safe on every confirm click, including
    // retries — the admin's existing "confirmed" button doubles as the
    // retry action, no separate UI/endpoint needed.
    //
    // The booking's own status update above is NOT rolled back if this
    // fails (separate, already-committed write — no shared transaction with
    // convertBookingToWedding's own internal one; see the investigation
    // this is fixing). That's intentional: the booking really is confirmed,
    // only the downstream Wedding creation is incomplete. Surface that
    // explicitly rather than hiding it behind a generic 500 or a silently
    // swallowed error, so the admin UI can tell the two cases apart and the
    // admin knows to retry.
    if (status === 'CONFIRMED') {
      try {
        await convertBookingToWedding(id);
      } catch (err) {
        if (err instanceof InvalidBookingStateError) {
          return NextResponse.json(
            {
              success: false,
              error: `Booking marked confirmed, but Wedding creation failed: ${err.message}. Fix the issue and click "confirmed" again to retry.`,
            },
            { status: 409 }
          );
        }
        throw err;
      }
    }

    return NextResponse.json({ success: true, data: toResponseShape(booking) });
  } catch (err) {
    return handleApiError(err);
  }
}
