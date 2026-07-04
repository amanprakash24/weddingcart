// node --env-file=.env.local scripts/seo-ashiyana-resort-localities.mjs [--write]
// Enriches Ashiyana Resort's description and adds one FAQ naturally mentioning
// the nearby West Patna localities (Digha, Ashiyana Nagar, Patliputra, Kurji,
// Boring Road) it should be findable for — requested to help this venue rank
// for local searches from those areas. Text only, no images touched.
import mongoose from 'mongoose';

const VENDOR_ID = 'ashiyana-resort-rukanpura';
const WRITE = process.argv.includes('--write');

const NEW_DESCRIPTION =
  'A spacious banquet hall and lawn venue on Ashiana–Digha Road in Rukanpura, Patna — easily reached from Digha, Ashiyana Nagar, Patliputra, Kurji, and Boring Road. Offering both indoor and outdoor settings for weddings and celebrations, the hall seats up to 300 guests (450 max) and the lawn accommodates up to 400 seated (600 max), with air-conditioned changing rooms and on-site guest rooms for outstation family.';

const NEW_FAQ = {
  q: 'Is Ashiyana Resort convenient for guests from Boring Road, Patliputra, or Kurji?',
  a: 'Yes — Ashiyana Resort sits on Ashiana-Digha Road in Rukanpura, a short drive from Boring Road, Patliputra, Ashiyana Nagar, Digha, and Kurji, making it an easy venue for guests coming from across West Patna.',
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { strict: false }));

  const vendor = await Vendor.findOne({ id: VENDOR_ID });
  if (!vendor) {
    console.log(`Vendor ${VENDOR_ID} not found.`);
    await mongoose.disconnect();
    return;
  }

  const alreadyHasFaq = (vendor.faqs || []).some((f) => f.q === NEW_FAQ.q);

  console.log(WRITE ? 'Writing changes...' : 'Dry run (pass --write to apply)');
  console.log('\n--- description ---');
  console.log('before:', vendor.description);
  console.log('after: ', NEW_DESCRIPTION);
  console.log('\n--- faq ---');
  console.log(alreadyHasFaq ? 'FAQ already present, skipping.' : `would add: "${NEW_FAQ.q}"`);

  if (WRITE) {
    // NOT vendor.save() — with a `strict: false` schema, Mongoose only persists
    // undeclared-path changes on .save() if markModified() is called first, so
    // a plain property assignment silently no-ops. findOneAndUpdate is the
    // pattern every other script in this repo uses for exactly this reason.
    const updatedFaqs = alreadyHasFaq ? vendor.faqs : [...(vendor.faqs || []), NEW_FAQ];
    const updated = await Vendor.findOneAndUpdate(
      { id: VENDOR_ID },
      { description: NEW_DESCRIPTION, faqs: updatedFaqs },
      { new: true },
    );
    console.log('\nSaved. Confirmed description now:', updated.description.slice(0, 60), '...');
    console.log('Confirmed faq count:', updated.faqs.length);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
