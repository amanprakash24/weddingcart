import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import OTP from '@/lib/models/OTP';
import VendorModel from '@/lib/models/Vendor';
import EnquiryModel from '@/lib/models/Enquiry';

export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return NextResponse.json({ success: false, message: 'Phone and OTP are required' }, { status: 400 });
    }

    await connectDB();

    const record = await OTP.findOne({ phone, code });
    if (!record) {
      return NextResponse.json({ success: false, message: 'Invalid or expired OTP. Please try again.' }, { status: 400 });
    }

    await OTP.deleteOne({ _id: record._id });

    const vendor = await VendorModel.findOne({ ownerPhone: phone }).lean();
    if (!vendor) {
      return NextResponse.json({ success: false, message: 'No vendor account found for this number. Please register first.' }, { status: 404 });
    }

    const enquiries = await EnquiryModel.find({ vendorId: (vendor as any).id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return NextResponse.json({ success: true, vendor, enquiries });
  } catch (err) {
    console.error('[vendor-auth]', err);
    return NextResponse.json({ success: false, message: 'Login failed. Please try again.' }, { status: 500 });
  }
}
