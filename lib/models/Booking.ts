import mongoose, { Schema, Document } from 'mongoose';

export interface IBooking extends Document {
  name: string;
  phone: string;
  city: string;
  items: { vendorId: string; vendorName: string; vendorCategory: string; packageName: string; price: number; quantity: number }[];
  total: number;
  status: 'new' | 'contacted' | 'confirmed' | 'closed';
  createdAt: Date;
}

const BookingSchema = new Schema<IBooking>({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  city: { type: String, required: true },
  items: [{
    vendorId: String,
    vendorName: String,
    vendorCategory: String,
    packageName: String,
    price: Number,
    quantity: Number,
  }],
  total: { type: Number, required: true },
  status: { type: String, enum: ['new', 'contacted', 'confirmed', 'closed'], default: 'new' },
}, { timestamps: true });

export default mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);
