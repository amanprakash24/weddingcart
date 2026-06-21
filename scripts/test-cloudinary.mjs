// node --env-file=.env.local scripts/test-cloudinary.mjs
import { v2 as cloudinary } from 'cloudinary';
import { createReadStream } from 'fs';
import { resolve } from 'path';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('Cloud name:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('API key set:', !!process.env.CLOUDINARY_API_KEY);

const filePath = resolve('C:/Users/anisha/Downloads/Best Banquet Hall - Sayamwar Hall.jpeg');
console.log('Uploading:', filePath);

const result = await new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    { folder: 'shaadishopping/swayamvar-hall', public_id: 'best-banquet-hall-swayamvar', overwrite: true },
    (error, res) => {
      if (error || !res) reject(error ?? new Error('failed'));
      else resolve(res);
    }
  );
  createReadStream(filePath).pipe(stream);
});

console.log('✅ URL:', result.secure_url);
