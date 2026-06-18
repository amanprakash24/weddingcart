// node --env-file=.env.local scripts/fix-swayamvar-duplicate.mjs
import mongoose from 'mongoose';

const VendorSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  category: String,
  city: String,
}, { timestamps: true, strict: false });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('❌  MONGODB_URI not found'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('✅  Connected to MongoDB');

  const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', VendorSchema);

  // List all venue vendors so we can see what IDs exist
  const venues = await Vendor.find({ category: 'venue' }).select('id name rating reviewCount').lean();
  console.log('\n📋  All venue vendors in DB:');
  venues.forEach(v => console.log(`  id: "${v.id}" | name: "${v.name}" | rating: ${v.rating} | reviews: ${v.reviewCount}`));

  // Delete the old Sayamwar entry — name spelled differently, higher priceMin (hall rental, not per plate)
  const deleted = await Vendor.deleteMany({
    name: { $regex: /sayamwar/i },
    id: { $ne: 'swayamvar-hall' }, // keep the correct one
  });
  console.log(`\n🗑️   Deleted ${deleted.deletedCount} duplicate(s) matching "sayamwar"`);

  // Also check for any other duplicate swayamvar entries
  const remaining = await Vendor.find({ name: { $regex: /swayamvar|sayamwar/i } }).select('id name').lean();
  console.log('\n✅  Remaining Swayamvar entries:');
  remaining.forEach(v => console.log(`  id: "${v.id}" | name: "${v.name}"`));

  await mongoose.disconnect();
  console.log('\n🎉  Done!');
}

run().catch((err) => { console.error('❌  Error:', err.message); process.exit(1); });
