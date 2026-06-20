// node --env-file=.env.local scripts/check-vendor-images.mjs
import mongoose from 'mongoose';

const VendorSchema = new mongoose.Schema({}, { strict: false });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Vendor = mongoose.model('Vendor', VendorSchema);

  const vendors = await Vendor.find(
    { name: { $regex: /swayamvar|skyline/i } },
    { name: 1, image: 1, images: 1 }
  );

  vendors.forEach(v => {
    console.log('Name:', v.name);
    console.log('image:', v.image);
    console.log('images:', v.images);
    console.log('---');
  });

  await mongoose.disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
