import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import ConsultationModel from '@/lib/models/Consultation';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const query = status ? { status } : {};
    const consultations = await ConsultationModel.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: consultations });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<string, string> = {
  venue: 'Venue', makeup: 'Makeup Artists', mehndi: 'Mehndi Artists',
  decorator: 'Decorators', band: 'Band & Music', dj: 'DJ Services',
  catering: 'Catering', 'photo-video': 'Photography & Video',
  accommodation: 'Accommodation', gifts: 'Gifts', invitations: 'Invitations',
  transport: 'Transportation', legal: 'Legal & Documentation',
  hospitality: 'Hospitality', planning: 'Wedding Planning',
  'bridal-lehenga': 'Bridal Lehenga', 'bridal-jewellery': 'Bridal Jewellery',
  sherwani: 'Sherwani / Groom Wear', trousseau: 'Trousseau Packing',
};

const BUDGET_LABELS: Record<string, string> = {
  'under-5L': 'Under ₹5 Lakh', '5-10L': '₹5–10 Lakh',
  '10-20L': '₹10–20 Lakh', '20-50L': '₹20–50 Lakh',
  '50L-1Cr': '₹50L–1 Crore', 'above-1Cr': 'Above ₹1 Crore',
};

function fmtDate(dateStr: string) {
  if (!dateStr) return 'Not specified';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtTime(time: string) {
  if (!time) return 'Flexible';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

// ── WhatsApp message builders ─────────────────────────────────────────────────

function buildAdminMessage(data: Record<string, unknown>) {
  const services = ((data.services as string[]) || [])
    .map((s) => SERVICE_LABELS[s] || s)
    .join(', ') || 'None';

  const budget = BUDGET_LABELS[data.budgetRange as string] || (data.budgetRange as string) || 'Not specified';

  const eventType = (data.eventType as string) || 'wedding';
  const eventLabel = eventType.charAt(0).toUpperCase() + eventType.slice(1);

  return (
    `📋 *New ${eventLabel} Plan Submitted — Action Required!*\n\n` +

    `👰 *Client Details*\n` +
    `• Name: ${data.name}\n` +
    `• Phone: +91 ${data.phone}\n` +
    `• Email: ${data.email || 'Not provided'}\n` +
    `• City: ${data.city}\n\n` +

    `💍 *Event Details*\n` +
    `• Event Type: ${eventLabel}\n` +
    `• Event Date: ${fmtDate(data.weddingDate as string)}\n` +
    `• Duration: ${data.days} day(s)\n` +
    `• Guests: ${data.guestCount}\n` +
    `• Style: ${(data.weddingStyle as string) ? (data.weddingStyle as string).charAt(0).toUpperCase() + (data.weddingStyle as string).slice(1) : 'Not specified'}\n` +
    `• Budget: ${budget}\n` +
    `• Food Preference: ${data.foodPreference || 'Not specified'}\n` +
    `• Venue Type: ${(data.venueType as string) ? (data.venueType as string).replace(/-/g, ' ') : 'Not specified'}\n\n` +

    `🛎️ *Services Requested (${((data.services as string[]) || []).length})*\n` +
    `${services}\n\n` +

    `📅 *Expert Call Requested*\n` +
    `• Date: ${fmtDate(data.consultationDate as string)}\n` +
    `• Time: ${fmtTime(data.preferredTime as string)}\n\n` +

    `📝 *Client Notes:*\n` +
    `${(data.message as string) || 'None'}\n\n` +

    `_Please call the client within 24 hours._\n` +
    `_— ShaadiShopping CRM_ 🎊`
  );
}

function buildUserMessage(data: Record<string, unknown>, expertName: string) {
  const budget = BUDGET_LABELS[data.budgetRange as string] || '';
  const consultDate = data.consultationDate ? fmtDate(data.consultationDate as string) : null;
  const consultTime = data.preferredTime ? fmtTime(data.preferredTime as string) : null;

  const callLine = consultDate
    ? `📅 *Date:* ${consultDate}\n⏰ *Time:* ${consultTime}`
    : `Our expert will reach out to confirm a convenient time for you.`;

  const evtType = (data.eventType as string) || 'wedding';
  const evtLabel = evtType.charAt(0).toUpperCase() + evtType.slice(1);

  return (
    `💍 *ShaadiShopping — Consultation Confirmed!*\n\n` +
    `Dear ${(data.name as string).split(' ')[0]},\n\n` +
    `Your ${evtLabel.toLowerCase()} planning consultation has been received and a dedicated expert has been assigned to you. We are so excited to be part of your special journey! 🌸\n\n` +

    `👨‍💼 *Your Dedicated Event Expert*\n` +
    `*${expertName}*\n` +
    `Senior Wedding Consultant\n` +
    `500+ weddings coordinated ⭐\n\n` +

    `📞 *Your Expert Call is Scheduled*\n` +
    `${callLine}\n\n` +

    `Here's what we'll help you with:\n` +
    `✨ Shortlist the finest vendors in ${data.city}\n` +
    (budget ? `💰 Plan your wedding within ${budget}\n` : '') +
    `🌸 Coordinate every detail of your dream day\n` +
    `🎊 Make your wedding truly unforgettable\n\n` +

    `For any urgent queries, we're always here:\n` +
    `📞 Call: *+91 76460 28228*\n` +
    `💬 WhatsApp: *wa.me/917646028228*\n\n` +

    `With love & warmest wishes,\n` +
    `*Team ShaadiShopping* 💕\n` +
    `_Your Dream Wedding, Our Promise_ 🌹`
  );
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const consultation = await ConsultationModel.create(body);

    const ADMIN_PHONE = '917646028228';
    const expertName = process.env.EXPERT_NAME || 'Priya Mishra';

    // Fire both messages concurrently — don't block the response on WhatsApp
    const adminMsg = buildAdminMessage(body);
    const userMsg  = buildUserMessage(body, expertName);

    await Promise.allSettled([
      sendWhatsAppMessage(ADMIN_PHONE, adminMsg),
      sendWhatsAppMessage(`91${body.phone}`, userMsg),
    ]);

    return NextResponse.json({ success: true, data: consultation }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
