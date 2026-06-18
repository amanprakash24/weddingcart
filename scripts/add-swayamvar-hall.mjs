// node --env-file=.env.local scripts/add-swayamvar-hall.mjs
import mongoose from 'mongoose';

const VendorSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  category: String,
  city: String,
  address: String,
  priceMin: Number,
  priceMax: Number,
  rating: Number,
  reviewCount: Number,
  description: String,
  image: String,
  images: [String],
  features: [String],
  packages: [mongoose.Schema.Types.Mixed],
  isFeatured: Boolean,
}, { timestamps: true });

const VENDOR = {
  id: 'swayamvar-hall',
  name: 'Swayamvar Hall & Homestay',
  category: 'venue',
  city: 'Patna',
  address: 'T Point, Gola Road, near Chanakya Puri, Danapur, Patna, Bihar 801503',
  priceMin: 1000,
  priceMax: 1500,
  rating: 4.8,
  reviewCount: 500,
  description: "Patna's premium banquet hall and homestay in Danapur. Rated 4.8★ across 500+ events. Fully air-conditioned hall for up to 500 guests with in-house catering, décor, home stay accommodation, and dedicated event coordinator.",
  image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=80',
  images: [
    'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=80',
  ],
  features: [
    'Fully Air-Conditioned Banquet Hall',
    'Up to 500 Guests Capacity',
    'In-House Catering (Veg & Non-Veg)',
    'Home Stay Accommodation Available',
    'Ample Parking Space',
    'Dedicated Event Coordinator',
    'Décor & Floral Arrangements',
    'Power Backup',
    'Stage & Sound Setup',
    '500+ Events Hosted',
  ],
  packages: [
    {
      id: 'veg',
      name: 'Vegetarian Package',
      price: 1000,
      isPerPlate: true,
      features: ['Veg Catering', 'Hall + Basic Décor', 'Parking', 'Coordinator'],
      isPopular: false,
    },
    {
      id: 'non-veg',
      name: 'Non-Vegetarian Package',
      price: 1300,
      isPerPlate: true,
      features: ['Veg + Non-Veg Catering', 'Hall + Décor', 'Parking', 'Coordinator'],
      isPopular: true,
    },
  ],
  isFeatured: true,
};

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('❌  MONGODB_URI not found in .env.local'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('✅  Connected to MongoDB');

  const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', VendorSchema);

  const existing = await Vendor.findOne({ id: VENDOR.id });
  if (existing) {
    console.log('⚠️   Vendor already exists — updating...');
    await Vendor.findOneAndReplace({ id: VENDOR.id }, VENDOR, { upsert: true });
    console.log('✅  Vendor updated:', VENDOR.name);
  } else {
    await Vendor.create(VENDOR);
    console.log('✅  Vendor created:', VENDOR.name);
  }

  await mongoose.disconnect();
  console.log('🎉  Done! Swayamvar Hall is now live at /lp/swayamvar-hall');
}

run().catch((err) => { console.error('❌  Error:', err.message); process.exit(1); });
