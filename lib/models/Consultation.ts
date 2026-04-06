import mongoose, { Schema, Document } from 'mongoose';

export interface IConsultation extends Document {
  name: string;
  phone: string;
  email: string;
  weddingDate: string;
  days: number;
  guestCount: number;
  foodPreference: string;
  services: string[];
  venueType: string;
  preferredTime?: string;
  message?: string;
  cartItems?: object[];
  totalBudget?: number;
  status: 'new' | 'contacted' | 'closed';
  createdAt: Date;
}

const ConsultationSchema = new Schema<IConsultation>({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  weddingDate: { type: String, required: true },
  days: { type: Number, required: true },
  guestCount: { type: Number, required: true },
  foodPreference: { type: String, required: true },
  services: [String],
  venueType: { type: String, required: true },
  preferredTime: String,
  message: String,
  cartItems: [Schema.Types.Mixed],
  totalBudget: Number,
  status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new' },
}, { timestamps: true });

export default mongoose.models.Consultation || mongoose.model<IConsultation>('Consultation', ConsultationSchema);
