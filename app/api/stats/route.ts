import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import VendorModel from '@/lib/models/Vendor';
import CategoryModel from '@/lib/models/Category';
import EnquiryModel from '@/lib/models/Enquiry';
import ConsultationModel from '@/lib/models/Consultation';

export async function GET() {
  try {
    await connectDB();

    const [vendors, categories, enquiries, consultations, newEnquiries, newConsultations] = await Promise.all([
      VendorModel.countDocuments(),
      CategoryModel.countDocuments(),
      EnquiryModel.countDocuments(),
      ConsultationModel.countDocuments(),
      EnquiryModel.countDocuments({ status: 'new' }),
      ConsultationModel.countDocuments({ status: 'new' }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        vendors,
        categories,
        enquiries,
        consultations,
        newEnquiries,
        newConsultations,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
