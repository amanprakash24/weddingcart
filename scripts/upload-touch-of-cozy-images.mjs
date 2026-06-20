// node --env-file=.env.local scripts/upload-touch-of-cozy-images.mjs
import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import { createReadStream } from 'fs';
import { resolve } from 'path';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const BlogSchema = new mongoose.Schema({
  title: String,
  slug: { type: String, unique: true },
  excerpt: String,
  content: String,
  coverImage: String,
  author: String,
  category: String,
  tags: [String],
  seoTitle: String,
  seoDescription: String,
  status: { type: String, default: 'draft' },
  publishedAt: Date,
  readTime: Number,
}, { timestamps: true });

function uploadToCloudinary(filePath, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'shaadishopping/touch-of-cozy', public_id: publicId, resource_type: 'image', overwrite: true },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload failed'));
        else resolve(result);
      }
    );
    createReadStream(filePath).pipe(stream);
  });
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('❌  MONGODB_URI not found in .env.local'); process.exit(1); }

  // Upload images
  console.log('📤  Uploading images to Cloudinary...');

  const img1Path = resolve('C:/Users/anisha/Downloads/Best Banquet Hall - Touch Of Cozy.jpeg');
  const img2Path = resolve('C:/Users/anisha/Downloads/Touch Of Cozy.jpeg');

  const result1 = await uploadToCloudinary(img1Path, 'best-banquet-hall-touch-of-cozy');
  console.log('✅  Uploaded image 1:', result1.secure_url);

  const result2 = await uploadToCloudinary(img2Path, 'touch-of-cozy-patna');
  console.log('✅  Uploaded image 2:', result2.secure_url);

  // Print URLs to use in component
  console.log('\n📋  Cloudinary URLs:');
  console.log('Image 1 (blog cover):', result1.secure_url);
  console.log('Image 2 (gallery)   :', result2.secure_url);

  // Update blog cover image
  await mongoose.connect(uri);
  console.log('\n✅  Connected to MongoDB');

  const Blog = mongoose.models.Blog || mongoose.model('Blog', BlogSchema);

  const updated = await Blog.findOneAndUpdate(
    { slug: 'touch-of-cozy-patna-review-best-banquet-hall-rajeev-nagar' },
    { coverImage: result1.secure_url },
    { new: true }
  );

  if (updated) {
    console.log('✅  Blog cover image updated:', updated.title);
  } else {
    console.log('⚠️   Blog not found with that slug. Trying other possible slugs...');
    const blogs = await Blog.find({ title: { $regex: /touch of cozy/i } });
    console.log('Found blogs:', blogs.map(b => ({ slug: b.slug, title: b.title })));
  }

  await mongoose.disconnect();
  console.log('🎉  Done!');
}

run().catch((err) => { console.error('❌  Error:', err.message); process.exit(1); });
