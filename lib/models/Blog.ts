import mongoose, { Schema, Document } from 'mongoose';

export interface IBlog extends Document {
  title: string;
  slug: string;
  excerpt: string;
  content: string; // HTML from TipTap
  coverImage: string;
  author: string;
  category: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  status: 'draft' | 'published';
  publishedAt: Date | null;
  readTime: number;
}

const BlogSchema = new Schema<IBlog>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, default: '' },
    content: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    author: { type: String, default: 'ShaadiShopping Team' },
    category: { type: String, default: 'Wedding Tips' },
    tags: [String],
    seoTitle: { type: String, default: '' },
    seoDescription: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: { type: Date, default: null },
    readTime: { type: Number, default: 1 },
  },
  { timestamps: true },
);

BlogSchema.index({ status: 1, publishedAt: -1 });
BlogSchema.index({ category: 1, status: 1 });

export default (mongoose.models.Blog as mongoose.Model<IBlog>) || mongoose.model<IBlog>('Blog', BlogSchema);
