// node --env-file=.env.local scripts/upload-swayamvar-images.mjs
import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import { createReadStream } from 'fs';
import { resolve } from 'path';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const VendorSchema = new mongoose.Schema({}, { strict: false });

const IMAGES = [
  { path: 'C:/Users/anisha/Downloads/Best Banquet Hall - Sayamwar Hall.jpeg',     id: 'best-banquet-hall-swayamvar' },
  { path: 'C:/Users/anisha/Downloads/sayamwar hall in patna.jpeg',                id: 'swayamvar-hall-patna' },
  { path: 'C:/Users/anisha/Downloads/selfie point banquet hall in patna.jpeg',    id: 'swayamvar-selfie-point' },
  { path: 'C:/Users/anisha/Downloads/mandap.jpeg',                                id: 'swayamvar-mandap' },
  { path: 'C:/Users/anisha/Downloads/200 - 300 capacity guests banquet.jpeg',     id: 'swayamvar-capacity-banquet' },
  { path: 'C:/Users/anisha/Downloads/baquet hall in patna.jpeg',                  id: 'swayamvar-banquet-hall' },
  { path: 'C:/Users/anisha/Downloads/banquet lawn.jpeg',                          id: 'swayamvar-lawn' },
];

function upload(filePath, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'shaadishopping/swayamvar-hall', public_id: publicId, resource_type: 'image', overwrite: true },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload failed'));
        else resolve(result);
      }
    );
    createReadStream(filePath).pipe(stream);
  });
}

async function run() {
  console.log('Uploading Swayamvar Hall images to Cloudinary...\n');

  const results = await Promise.all(
    IMAGES.map(img => upload(resolve(img.path), img.id))
  );
  const urls = results.map((result, i) => {
    console.log(`✅ ${IMAGES[i].id}\n   ${result.secure_url}`);
    return result.secure_url;
  });

  console.log('\nConnecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  const Vendor = mongoose.model('Vendor', VendorSchema);

  await Vendor.findOneAndUpdate(
    { name: { $regex: /swayamvar/i } },
    { image: urls[0], images: urls }
  );

  console.log('\n✅ Swayamvar Hall vendor updated with real photos');
  console.log('Main image:', urls[0]);
  console.log('Total images:', urls.length);

  await mongoose.disconnect();
  console.log('\n🎉 Done!');
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
