// node --env-file=.env.local scripts/unfeature-placeholder-venues.mjs [--write]
// venue-1..venue-5 are leftover demo seed data (Mumbai/Jaipur/Bangalore/Delhi/Goa,
// blank addresses, fabricated ratings/review counts) — not real ShaadiShopping
// listings. Unfeaturing them so they stop surfacing in FeaturedVendorsSection.
import mongoose from 'mongoose';

const IDS = ['venue-1', 'venue-2', 'venue-3', 'venue-4', 'venue-5'];
const WRITE = process.argv.includes('--write');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { strict: false }));

  const vendors = await Vendor.find({ id: { $in: IDS } }).select('id name isFeatured');
  console.log(WRITE ? 'Writing changes...' : 'Dry run (pass --write to apply)');
  for (const v of vendors) {
    console.log(`${v.id} (${v.name}): isFeatured ${v.isFeatured} -> false`);
  }

  if (WRITE) {
    const result = await Vendor.updateMany({ id: { $in: IDS } }, { isFeatured: false });
    console.log(`\nUpdated ${result.modifiedCount} vendors.`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
