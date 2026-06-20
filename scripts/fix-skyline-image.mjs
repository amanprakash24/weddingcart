// node --env-file=.env.local scripts/fix-skyline-image.mjs
// Gives Skyline Banquet Hall a distinct image so it no longer matches Swayamvar Hall
import mongoose from 'mongoose';

const VendorSchema = new mongoose.Schema({}, { strict: false });

// A grand banquet/wedding hall image — different from the Swayamvar one
const SKYLINE_IMAGE = 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200&q=80';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Vendor = mongoose.model('Vendor', VendorSchema);

  await Vendor.findOneAndUpdate(
    { name: { $regex: /skyline/i } },
    { image: SKYLINE_IMAGE, images: [SKYLINE_IMAGE] }
  );

  console.log('Skyline image updated:', SKYLINE_IMAGE);
  await mongoose.disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
