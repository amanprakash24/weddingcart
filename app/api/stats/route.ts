import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import VendorModel from '@/lib/models/Vendor';
import CategoryModel from '@/lib/models/Category';
import EnquiryModel from '@/lib/models/Enquiry';
import ConsultationModel from '@/lib/models/Consultation';
import BookingModel from '@/lib/models/Booking';
import VendorApplicationModel from '@/lib/models/VendorApplication';

export async function GET() {
  try {
    await connectDB();

    const [vendors, categories, enquiries, consultations, newEnquiries, newConsultations, bookings, newBookings, outsideVendors, newOutsideVendors] = await Promise.all([
      VendorModel.countDocuments(),
      CategoryModel.countDocuments(),
      EnquiryModel.countDocuments(),
      ConsultationModel.countDocuments(),
      EnquiryModel.countDocuments({ status: 'new' }),
      ConsultationModel.countDocuments({ status: 'new' }),
      BookingModel.countDocuments(),
      BookingModel.countDocuments({ status: 'new' }),
      VendorApplicationModel.countDocuments(),
      VendorApplicationModel.countDocuments({ status: 'new' }),
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
        bookings,
        newBookings,
        outsideVendors,
        newOutsideVendors,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
