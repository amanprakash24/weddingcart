// node --env-file=.env.local scripts/unfeature-non-patna-vendors.mjs [--write]
// All 40 non-Patna vendors (Delhi/Jaipur/Mumbai/Bangalore/Goa/Udaipur) are
// leftover data/seedData.ts demo records from before the platform pivoted to
// Patna/Bihar — blank addresses, fabricated ratings/review counts, all created
// in the same batch (2026-06-05T11:39:26). Unfeaturing so they stop competing
// for homepage placement in FeaturedVendorsSection; left in the DB (not
// deleted) since they still back the /cities/{city}/{category} pages for
// those non-Bihar cities.
import mongoose from 'mongoose';

const WRITE = process.argv.includes('--write');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { strict: false }));

  const vendors = await Vendor.find({ city: { $ne: 'Patna' }, isFeatured: true })
    .select('id name city category isFeatured');

  console.log(WRITE ? 'Writing changes...' : 'Dry run (pass --write to apply)');
  console.log(`${vendors.length} non-Patna vendors currently isFeatured:true`);
  for (const v of vendors) {
    console.log(`${v.id} (${v.name}, ${v.city}, ${v.category}): isFeatured true -> false`);
  }

  if (WRITE) {
    const result = await Vendor.updateMany({ city: { $ne: 'Patna' } }, { isFeatured: false });
    console.log(`\nUpdated ${result.modifiedCount} vendors.`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
