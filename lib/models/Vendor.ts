import mongoose, { Schema, Document } from 'mongoose';

const PackageSchema = new Schema({
  id: String,
  name: String,
  description: String,
  price: Number,
  features: [String],
  isPopular: Boolean,
});

export interface IVendor extends Document {
  id: string;
  name: string;
  category: string;
  city: string;
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
  category: { type: String, required: true },
  city: { type: String, required: true },
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

export default mongoose.models.Vendor || mongoose.model<IVendor>('Vendor', VendorSchema);
