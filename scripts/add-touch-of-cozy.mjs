/**
 * One-time script to add Touch of Cozy venue to MongoDB.
 * Run from project root: node scripts/add-touch-of-cozy.mjs
 *
 * Requires MONGODB_URI in .env.local
 */

// Run with: node --env-file=.env.local scripts/add-touch-of-cozy.mjs
import mongoose from 'mongoose';

const VENDOR = {
  id: 'touch-of-cozy-patna',
  name: 'Touch of Cozy',
  ownerName: '',
  ownerPhone: '+917986519662',
  ownerEmail: '',
  category: 'venue',
  city: 'Patna',
  address: 'Rajeev Nagar Road No 23, Near Atal Path Branch Road, Mica Colony, Patna-12',
  priceMin: 90000,
  priceMax: 600000,
  rating: 5.0,
  reviewCount: 1,
  image: 'https://drive.google.com/uc?export=view&id=1YCJDtzGOr-_AUlFB45S3VID7RDB2-olv',
  images: [
    'https://drive.google.com/uc?export=view&id=1YCJDtzGOr-_AUlFB45S3VID7RDB2-olv',
    'https://drive.google.com/uc?export=view&id=1S0gnrtdVcs0EPKT_sswM4LbMY7VVVDrb',
    'https://drive.google.com/uc?export=view&id=1dDFIrRTdUHP9ZAfbH6ErpMtuPvjShYv9',
    'https://drive.google.com/uc?export=view&id=1duFy5pM_S5a0sfDyUxwP0gVP1yQVLsVj',
    'https://drive.google.com/uc?export=view&id=1owweHFt_un07_Occ6FYxUM7U2Z_Kw_Rz',
    'https://drive.google.com/uc?export=view&id=1f-hCPa9YSaxIGRSwBjBz-WoCBPINsWjk',
    'https://drive.google.com/uc?export=view&id=1TmXZx116l5JzdIMLdltupApJ-8MFyAPG',
    'https://drive.google.com/uc?export=view&id=1zrkhWuYg3RiORHEirsN3lTCPATU3JN24',
  ],
  description:
    "Touch of Cozy is Patna's premier banquet hall, café, and guest stay destination — where elegance meets comfort. Located in Mica Colony, Rajeev Nagar, we host weddings, engagements, birthdays, anniversaries, corporate events, and family functions with personalized care. Our AC banquet hall accommodates large gatherings with in-house catering and decoration, 5 complimentary guest rooms, and valet-assisted parking for 40–45 vehicles. Baraats are welcome, and overnight weddings are supported. We operate from 11 AM to 12 AM daily.",
  features: [
    'AC Banquet Hall',
    '5 Complimentary Rooms with Events',
    'In-House Catering',
    'In-House Decoration',
    'Valet Parking (40–45 vehicles)',
    'Café Services',
    'Baraat Permitted',
    'Overnight Weddings Allowed',
    'Guest Accommodations',
    'Operating Hours: 11 AM – 12 AM',
    'Alcohol-Free Venue',
  ],
  packages: [
    {
      id: 'veg-standard',
      name: 'Veg Standard Package',
      description: 'Pure vegetarian catering for all events. Inclusive of banquet hall and basic decoration.',
      price: 900,
      features: [
        '₹900 per plate (all-inclusive)',
        'Pure vegetarian menu',
        'Banquet hall access',
        'Basic decoration',
        'In-house catering team',
      ],
      isPopular: false,
      image: '',
    },
    {
      id: 'non-veg-standard',
      name: 'Non-Veg Standard Package',
      description: 'Non-vegetarian catering with full banquet hall access and decoration.',
      price: 1000,
      features: [
        '₹1000 per plate (all-inclusive)',
        'Non-vegetarian menu',
        'Banquet hall access',
        'Standard decoration',
        'In-house catering team',
      ],
      isPopular: false,
      image: '',
    },
    {
      id: 'veg-platinum',
      name: 'Veg Platinum Package',
      description: 'Premium vegetarian experience with upgraded decor and enhanced menu.',
      price: 1000,
      features: [
        '₹1000 per plate (all-inclusive)',
        'Premium vegetarian menu',
        'Enhanced decoration',
        '5 complimentary guest rooms',
        'Valet parking',
        'Dedicated event coordinator',
      ],
      isPopular: true,
      image: '',
    },
    {
      id: 'non-veg-platinum',
      name: 'Non-Veg Platinum Package',
      description: 'Our most complete offering — premium non-veg dining with luxury décor and full amenities.',
      price: 1250,
      features: [
        '₹1250 per plate (all-inclusive)',
        'Premium non-vegetarian menu',
        'Luxury decoration',
        '5 complimentary guest rooms',
        'Valet parking',
        'Dedicated event coordinator',
        'Café access',
      ],
      isPopular: false,
      image: '',
    },
  ],
  isFeatured: false,
};

const VendorSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: String, ownerName: String, ownerPhone: String, ownerEmail: String,
  category: String, city: String, address: String,
  priceMin: Number, priceMax: Number,
  rating: Number, reviewCount: Number,
  image: String, images: [String],
  description: String, features: [String],
  packages: [{
    id: String, name: String, description: String,
    price: Number, features: [String], isPopular: Boolean, image: String,
  }],
  isFeatured: Boolean,
}, { timestamps: true });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌  MONGODB_URI not found in .env.local');
    process.exit(1);
  }

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
  console.log('🎉  Done! Touch of Cozy is now listed on the website.');
}

run().catch((err) => {
  console.error('❌  Error:', err.message);
  process.exit(1);
});
