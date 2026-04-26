import mongoose, { Schema, Document } from 'mongoose';

export interface IVendorApplication extends Document {
  businessName: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  category: string;
  city: string;
  priceMin: number;
  priceMax: number;
  experience: string;
  description: string;
  instagram: string;
  website: string;
  coverImage: string;
  status: 'new' | 'approved' | 'rejected';
  vendorId: string; // set once vendor is created on approval
}

const VendorApplicationSchema = new Schema<IVendorApplication>(
  {
    businessName: { type: String, required: true },
    ownerName:    { type: String, required: true },
    ownerPhone:   { type: String, required: true },
    ownerEmail:   { type: String, required: true },
    category:     { type: String, required: true },
    city:         { type: String, required: true },
    priceMin:     { type: Number, default: 0 },
    priceMax:     { type: Number, default: 0 },
    experience:   { type: String, default: '' },
    description:  { type: String, default: '' },
    instagram:    { type: String, default: '' },
    website:      { type: String, default: '' },
    coverImage:   { type: String, default: '' },
    status:       { type: String, enum: ['new', 'approved', 'rejected'], default: 'new' },
    vendorId:     { type: String, default: '' },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV !== 'production') {
  delete (mongoose.models as Record<string, unknown>).VendorApplication;
}

export default mongoose.model<IVendorApplication>('VendorApplication', VendorApplicationSchema);
