import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import InvoiceModel from '@/lib/models/Invoice';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await connectDB();
    const invoices = await InvoiceModel.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: invoices });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await connectDB();
    const body = await req.json();

    const count = await InvoiceModel.countDocuments();
    const pad = String(count + 1).padStart(4, '0');
    const d = new Date();
    const invoiceNumber = `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${pad}`;

    const invoice = await InvoiceModel.create({ ...body, invoiceNumber });
    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create invoice' }, { status: 500 });
  }
}
