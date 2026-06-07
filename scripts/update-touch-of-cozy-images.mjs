// node --env-file=.env.local scripts/update-touch-of-cozy-images.mjs
import mongoose from 'mongoose';

const toHiRes = (id) => `https://drive.google.com/thumbnail?id=${id}&sz=w1920`;

const IMAGE_IDS = [
  '1YCJDtzGOr-_AUlFB45S3VID7RDB2-olv',
  '1S0gnrtdVcs0EPKT_sswM4LbMY7VVVDrb',
  '1dDFIrRTdUHP9ZAfbH6ErpMtuPvjShYv9',
  '1duFy5pM_S5a0sfDyUxwP0gVP1yQVLsVj',
  '1owweHFt_un07_Occ6FYxUM7U2Z_Kw_Rz',
  '1f-hCPa9YSaxIGRSwBjBz-WoCBPINsWjk',
  '1TmXZx116l5JzdIMLdltupApJ-8MFyAPG',
  '1zrkhWuYg3RiORHEirsN3lTCPATU3JN24',
  '1umTkT1iPHn0R-KfWp0jS3yNcWk0r1-Yr',
  '1A17KYI68Q0IKtPX6dZz9-WJGuMPq9SXk',
  '1_4EAgScoUbmznjGQiY_rj-KjxhnECavS',
  '17KaXCqOkney2Q8kSiTACTk5rcANKenD',
  '13bez2GSSfZh3hJP-9pmVenYRlEodX8le',
  '1Gwqg6HcWX1rGO5s6EKwv9F6nTmNdnG8l',
  '1WDfXZ4j7sePXZVwhmESgl7rpvBEQo54F',
  '167D1RJYVfKp99rUMkC7TCJR8KHic0uJJ',
  '1yMIElAnq_2gXcnVM7JPU9HYr9CTpiKfK',
];

const images = IMAGE_IDS.map(toHiRes);

const VendorSchema = new mongoose.Schema({ id: String }, { strict: false });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('❌  MONGODB_URI not found'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('✅  Connected to MongoDB');

  const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', VendorSchema);

  const result = await Vendor.findOneAndUpdate(
    { id: 'touch-of-cozy-patna' },
    { $set: { image: images[0], images } },
    { new: true }
  );

  if (!result) { console.error('❌  Vendor not found'); process.exit(1); }

  console.log(`✅  Updated with ${images.length} hi-res images`);
  await mongoose.disconnect();
  console.log('🎉  Done!');
}

run().catch((err) => { console.error('❌', err.message); process.exit(1); });
