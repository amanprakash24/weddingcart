import { NextRequest, NextResponse } from 'next/server';
import { eventService } from '@/services/event.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = await eventService.createOrder(id, {
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail ?? null,
      passTypeId: body.passTypeId,
      quantity: body.quantity ?? 1,
      paymentProvider: body.paymentProvider ?? 'RAZORPAY',
      paymentReference: body.paymentReference ?? 'dev-mode',
      notes: body.notes ?? null,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create order';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
