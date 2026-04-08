import mongoose, { Schema, Document } from 'mongoose';

export interface IEnquiry extends Document {
  vendorId: string;
  vendorName: string;
  vendorCategory: string;
  name: string;
  phone: string;
  email?: string;
  city: string;
  eventDate: string;
  guestCount?: string;
  eventType: string;
  message?: string;
  status: 'new' | 'contacted' | 'closed';
  createdAt: Date;
}

const EnquirySchema = new Schema<IEnquiry>({
  vendorId: { type: String, required: true },
  vendorName: { type: String, required: true },
  vendorCategory: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: String,
  city: { type: String, required: true },
  eventDate: { type: String, required: true },
  guestCount: String,
  eventType: { type: String, required: true },
  message: String,
  status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new' },
}, { timestamps: true });

export default mongoose.models.Enquiry || mongoose.model<IEnquiry>('Enquiry', EnquirySchema);
