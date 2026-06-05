import mongoose, { Schema, Document } from 'mongoose';

const PackageSchema = new Schema({
  id: String,
  name: String,
  description: String,
  price: Number,
  features: [String],
  isPopular: Boolean,
  image: { type: String, default: '' },
});

export interface IVendor extends Document {
  id: string;
  name: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  category: string;
  city: string;
  address?: string;
  priceMin: number;
  priceMax: number;
  rating: number;
  reviewCount: number;
  image: string;
  images: string[];
  description: string;
  features: string[];
  packages: typeof PackageSchema[];
  isFeatured: boolean;
}

const VendorSchema = new Schema<IVendor>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  ownerName: { type: String, default: '' },
  ownerPhone: { type: String, default: '' },
  ownerEmail: { type: String, default: '' },
  category: { type: String, required: true },
  city: { type: String, required: true },
  address: { type: String, default: '' },
  priceMin: { type: Number, required: true },
  priceMax: { type: Number, required: true },
  rating: { type: Number, default: 4.5 },
  reviewCount: { type: Number, default: 0 },
  image: { type: String, required: true },
  images: [String],
  description: { type: String, required: true },
  features: [String],
  packages: [PackageSchema],
  isFeatured: { type: Boolean, default: false },
}, { timestamps: true });

VendorSchema.index({ category: 1, city: 1, rating: -1 });
VendorSchema.index({ name: 'text', description: 'text' });

export default (mongoose.models.Vendor as mongoose.Model<IVendor>) || mongoose.model<IVendor>('Vendor', VendorSchema);
