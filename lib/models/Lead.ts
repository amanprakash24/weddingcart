import mongoose, { Schema, Document } from 'mongoose';

export interface ILead extends Document {
  phone: string;
  whatsapp: boolean;
  source: string;
  createdAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    phone:    { type: String, required: true },
    whatsapp: { type: Boolean, default: false },
    source:   { type: String, default: 'popup' },
  },
  { timestamps: true }
);

export default (mongoose.models.Lead as mongoose.Model<ILead>) ||
  mongoose.model<ILead>('Lead', LeadSchema);
