// node --env-file=.env.local scripts/upload-touch-of-cozy-gallery.mjs
import { v2 as cloudinary } from 'cloudinary';
import { createReadStream } from 'fs';
import { resolve } from 'path';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const IMAGES = [
  { path: 'C:/Users/anisha/Downloads/Best Banquet Hall - Touch Of Cozy.jpeg', id: 'best-banquet-hall-touch-of-cozy' },
  { path: 'C:/Users/anisha/Downloads/touch f cozy.jpeg',                       id: 'touch-of-cozy-venue' },
  { path: 'C:/Users/anisha/Downloads/best banquet hall in patna.jpeg',         id: 'best-banquet-hall-patna' },
  { path: 'C:/Users/anisha/Downloads/Best Banquet Hall - Touch.jpeg',          id: 'touch-of-cozy-hall' },
  { path: 'C:/Users/anisha/Downloads/touch of cozy 2.jpeg',                   id: 'touch-of-cozy-2' },
  { path: 'C:/Users/anisha/Downloads/touch of cozy 1.jpeg',                   id: 'touch-of-cozy-1' },
  { path: 'C:/Users/anisha/Downloads/Touch Of Cozy.jpeg',                     id: 'touch-of-cozy-patna' },
];

function upload(filePath, publicId) {
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
  console.log('Uploading Touch of Cozy images to Cloudinary...\n');

  const results = await Promise.all(IMAGES.map(img => upload(resolve(img.path), img.id)));

  results.forEach((r, i) => console.log(`✅ ${IMAGES[i].id}\n   ${r.secure_url}`));

  console.log('\n📋 All URLs:');
  results.forEach(r => console.log(r.secure_url));
  console.log('\n🎉 Done!');
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
