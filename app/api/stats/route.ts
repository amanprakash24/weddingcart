import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import VendorModel from '@/lib/models/Vendor';
import CategoryModel from '@/lib/models/Category';
import EnquiryModel from '@/lib/models/Enquiry';
import ConsultationModel from '@/lib/models/Consultation';
import BookingModel from '@/lib/models/Booking';
import VendorApplicationModel from '@/lib/models/VendorApplication';
import LeadModel from '@/lib/models/Lead';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await connectDB();

    const [
      vendors, categories, enquiries, consultations,
      newEnquiries, newConsultations, bookings, newBookings,
      outsideVendors, newOutsideVendors, leads,
      revenueAgg,
    ] = await Promise.all([
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
      LeadModel.countDocuments(),
      BookingModel.aggregate([
        { $match: { status: { $in: ['confirmed', 'closed'] } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
    ]);

    const revenue = revenueAgg[0]?.total ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        vendors, categories, enquiries, consultations,
        newEnquiries, newConsultations, bookings, newBookings,
        outsideVendors, newOutsideVendors, leads, revenue,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
