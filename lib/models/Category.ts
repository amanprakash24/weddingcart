import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  id: string;
  name: string;
  icon: string;
  description: string;
  vendorCount: number;
  image: string;
  isSpecial: boolean;
}

const CategorySchema = new Schema<ICategory>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  icon: { type: String, required: true },
  description: { type: String, required: true },
  vendorCount: { type: Number, default: 0 },
  image: { type: String, required: true },
  isSpecial: { type: Boolean, default: false },
}, { timestamps: true });

if (process.env.NODE_ENV !== 'production') {
  delete (mongoose.models as Record<string, unknown>).Category;
}

export default mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema);
