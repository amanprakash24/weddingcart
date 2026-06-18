import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoiceItem {
  description: string;
  vendorName?: string;
  amount: number;
  quantity: number;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  clientCity?: string;
  eventDate?: string;
  eventType?: string;
  items: IInvoiceItem[];
  subtotal: number;
  gstEnabled: boolean;
  gstAmount: number;
  total: number;
  notes?: string;
  status: 'draft' | 'sent' | 'paid';
  createdAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItem>({
  description: { type: String, required: true },
  vendorName: String,
  amount: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
});

const InvoiceSchema = new Schema<IInvoice>({
  invoiceNumber: { type: String, required: true, unique: true },
  clientName: { type: String, required: true },
  clientPhone: { type: String, required: true },
  clientEmail: String,
  clientCity: String,
  eventDate: String,
  eventType: String,
  items: [InvoiceItemSchema],
  subtotal: { type: Number, required: true },
  gstEnabled: { type: Boolean, default: true },
  gstAmount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  notes: String,
  status: { type: String, enum: ['draft', 'sent', 'paid'], default: 'draft' },
}, { timestamps: true });

export default mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema);
