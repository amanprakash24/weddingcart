// node --env-file=.env.local scripts/add-7-vachan.mjs
import mongoose from 'mongoose';

const VendorSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  category: String,
  city: String,
  area: String,
  address: String,
  phone: String,
  priceMin: Number,
  priceMax: Number,
  rating: Number,
  reviewCount: Number,
  description: String,
  images: [String],
  features: [String],
  packages: [mongoose.Schema.Types.Mixed],
  established: String,
  openingHours: String,
  featured: Boolean,
  status: { type: String, default: 'active' },
}, { timestamps: true });

const VENDOR = {
  id: '7-vachan-patna',
  name: '7 Vachan',
  category: 'venue',
  city: 'patna',
  area: 'Judges Colony',
  address: 'Near Fashion Factory Godawari Complex, Opposite Purise Hospital, Saguna Mor, Danapur Khagaul Road, Judges Colony, Patna – 801503',
  phone: '+919980122191',
  priceMin: 1100,
  priceMax: 1300,
  rating: 4.6,
  reviewCount: 55,
  description: "Patna's trusted banquet hall in Judges Colony, Saguna Mor. Rated 4.6★ across 55 reviews. Established in 2016, hosting weddings, receptions, engagements, birthdays, baby showers, and corporate events with in-house catering and DJ.",
  images: [
    'https://content.jdmagicbox.com/v2/comp/patna/z3/0612px612.x612.250508092933.e8z3/catalogue/7-vachan-judges-colony-patna-banquet-halls-z4mw544mkw.jpg',
    'https://content.jdmagicbox.com/v2/comp/patna/z3/0612px612.x612.250508092933.e8z3/catalogue/7-vachan-judges-colony-patna-banquet-halls-8m6z2kwjts.jpg',
    'https://content.jdmagicbox.com/v2/comp/patna/z3/0612px612.x612.250508092933.e8z3/catalogue/7-vachan-judges-colony-patna-banquet-halls-qph2udv4ww.jpg',
    'https://content.jdmagicbox.com/v2/comp/patna/z3/0612px612.x612.250508092933.e8z3/catalogue/7-vachan-judges-colony-patna-banquet-halls-nbq6ctgpje.jpg',
    'https://content.jdmagicbox.com/v2/comp/patna/z3/0612px612.x612.250508092933.e8z3/catalogue/7-vachan-judges-colony-patna-banquet-halls-xxlkm18nj1.jpg',
  ],
  features: [
    'AC Banquet Hall (Multiple Capacities)',
    '7 Guest Rooms Available',
    'In-House Catering — Veg & Non-Veg',
    'In-House DJ Available',
    'Ample Parking Available',
    'Rooftop Venue Option',
    'Play Area for Kids',
    'Wheelchair Accessible',
    '500+ Guests Capacity',
    'Established 2016 — 10 Years in Business',
  ],
  packages: [
    {
      id: 'veg',
      name: 'Vegetarian Package',
      price: 1100,
      unit: 'per plate',
      highlights: ['₹1,100 per plate', 'Full Veg Menu', 'In-House Catering', 'Hall + Décor Included'],
      isPopular: false,
    },
    {
      id: 'non-veg',
      name: 'Non-Vegetarian Package',
      price: 1300,
      unit: 'per plate',
      highlights: ['₹1,300 per plate', 'Veg + Non-Veg Menu', 'In-House Catering', 'Hall + Décor Included'],
      isPopular: true,
    },
  ],
  established: '2016',
  openingHours: 'Mon-Sun: 9:00 AM – 10:00 PM',
  featured: true,
  status: 'active',
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
  console.log('🎉  Done! 7 Vachan is now live at /lp/7-vachan-patna');
}

run().catch((err) => { console.error('❌  Error:', err.message); process.exit(1); });
