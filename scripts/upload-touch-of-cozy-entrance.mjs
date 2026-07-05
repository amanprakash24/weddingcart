// node --env-file=.env.local scripts/upload-touch-of-cozy-entrance.mjs
import { v2 as cloudinary } from 'cloudinary';
import { createReadStream } from 'fs';
import { resolve } from 'path';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function uploadToCloudinary(filePath, publicId) {
  return new Promise((resolvePromise, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'shaadishopping/touch-of-cozy', public_id: publicId, resource_type: 'image', overwrite: true },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload failed'));
        else resolvePromise(result);
      }
    );
    createReadStream(filePath).pipe(stream);
  });
}

async function run() {
  const imgPath = resolve('C:/Users/anisha/Downloads/toc entrance.jpg');
  console.log('📤  Uploading Touch of Cozy entrance photo to Cloudinary...');
  const result = await uploadToCloudinary(imgPath, 'touch-of-cozy-entrance');
  console.log('✅  Uploaded:', result.secure_url);
}

run().catch((err) => { console.error('❌  Error:', err.message); process.exit(1); });
