// node --env-file=.env.local scripts/add-faq-to-touch-of-cozy-blog.mjs
import mongoose from 'mongoose';

const BlogSchema = new mongoose.Schema({}, { strict: false });
const SLUG = 'touch-of-cozy-patna-review-best-banquet-hall-rajeev-nagar';

const FAQ_HTML = `
<h2>Frequently Asked Questions — Touch of Cozy Patna</h2>

<h3>Is Touch of Cozy the best banquet hall in Patna?</h3>
<p>Touch of Cozy is consistently ranked among the top banquet halls in Patna. Located in Mica Colony, Rajeev Nagar (Patliputra area), it is rated 5.0★ by 47+ couples on Google. Its combination of transparent per-plate pricing, 5 guest rooms, FSSAI kitchen, baraat facility, and overnight wedding support makes it one of the best banquet halls in Patna for weddings and receptions in the 200–400 guest range.</p>

<h3>What is the starting price at Touch of Cozy?</h3>
<p>Touch of Cozy packages start at <strong>₹999 per plate</strong> (Veg Gold) and go up to ₹1,599 per plate (Non-Veg Luxury). All packages include banquet hall access and basic decoration. The Veg Luxury package at ₹1,351/plate is the most popular choice for weddings.</p>

<h3>Does Touch of Cozy allow baraat and overnight weddings?</h3>
<p>Yes. Touch of Cozy explicitly welcomes baraat processions and supports overnight weddings. The venue operates from 11 AM to 12 AM daily. This is important for Bihari wedding traditions where functions often extend late into the night.</p>

<h3>How many guests can Touch of Cozy accommodate?</h3>
<p>Touch of Cozy comfortably seats 200–350 guests for a dinner reception. For cocktail-style gatherings, it can accommodate up to 400+ guests. Valet parking is available for 40–45 vehicles.</p>

<h3>Does Touch of Cozy have guest rooms?</h3>
<p>Yes. Touch of Cozy has <strong>5 guest rooms</strong> included with event bookings at no additional charge. The rooms are air-conditioned and ideal for the bridal family and outstation relatives staying overnight.</p>

<h3>How do I book Touch of Cozy through ShaadiShopping?</h3>
<p>ShaadiShopping is the authorised booking partner for Touch of Cozy. <a href="/lp/touch-of-cozy" style="color:#8B1A4A;font-weight:600;">Enquire on our Touch of Cozy page</a> or call <strong>+91 76460 28228</strong>. Our Patna team will check date availability and share a custom quote — completely free for couples.</p>
`.trim();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Blog = mongoose.model('Blog', BlogSchema);
  const blog = await Blog.findOne({ slug: SLUG });
  if (!blog) { console.error('Blog not found'); process.exit(1); }

  if (blog.content.includes('Frequently Asked Questions')) {
    console.log('FAQ section already exists — skipping');
    await mongoose.disconnect(); return;
  }

  // Insert FAQ before "Our Verdict" section
  const insertBefore = '<h2>Our Verdict';
  if (!blog.content.includes(insertBefore)) {
    console.error('Anchor text not found'); process.exit(1);
  }

  const newContent = blog.content.replace(insertBefore, FAQ_HTML + '\n\n' + insertBefore);
  await Blog.findOneAndUpdate({ slug: SLUG }, { content: newContent });
  console.log('✅ FAQ section added to blog post');
  await mongoose.disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
