// node --env-file=.env.local scripts/update-bn-club-images-rating-location.mjs
import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import { createReadStream } from 'fs';
import { resolve } from 'path';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const SCRATCH = 'C:/Users/anisha/AppData/Local/Temp/claude/C--weddingcart-weddingcart/75d23dfc-a7bf-4f9e-b16d-0f2e89561373/scratchpad/bn-club-gmaps';

const PHOTOS = [
  { file: 'photo-10.jpg', id: 'bn-club-hall-wide' },
  { file: 'photo-6.jpg', id: 'bn-club-stage-decor' },
  { file: 'photo-2.jpg', id: 'bn-club-chandelier-arch' },
  { file: 'photo-8.jpg', id: 'bn-club-outdoor-dancefloor' },
  { file: 'photo-4.jpg', id: 'bn-club-table-setting' },
  { file: 'photo-5.jpg', id: 'bn-club-hall-event' },
];

function uploadToCloudinary(filePath, publicId) {
  return new Promise((resolvePromise, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'shaadishopping/bn-club-banquet-hall', public_id: publicId, resource_type: 'image', overwrite: true },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload failed'));
        else resolvePromise(result);
      }
    );
    createReadStream(filePath).pipe(stream);
  });
}

const VendorSchema = new mongoose.Schema({ id: String }, { strict: false });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not found'); process.exit(1); }

  console.log('Uploading images to Cloudinary...');
  const urls = [];
  for (const p of PHOTOS) {
    const result = await uploadToCloudinary(resolve(SCRATCH, p.file), p.id);
    console.log('Uploaded:', p.id, '->', result.secure_url);
    urls.push(result.secure_url);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', VendorSchema);

  const result = await Vendor.findOneAndUpdate(
    { id: 'bn-club-banquet-hall-patna' },
    {
      $set: {
        image: urls[0],
        images: urls,
        rating: 4.3,
        reviewCount: 114,
        mapEmbedUrl: 'https://www.google.com/maps?q=25.6162916,85.0752591&z=17&output=embed',
        address: 'Parasnath Garden Hall, Ramnagri More, Besides Ashiana Nagar Phase 1, Rukanpura, Patna, Bihar 800025',
      },
    },
    { new: true }
  );

  if (!result) { console.error('Vendor not found'); process.exit(1); }

  console.log(`Updated B N Club Banquet Hall: ${urls.length} images, rating ${result.rating} (${result.reviewCount} reviews)`);
  await mongoose.disconnect();
  console.log('Done!');
}

run().catch((err) => { console.error('Error:', err.message); process.exit(1); });
