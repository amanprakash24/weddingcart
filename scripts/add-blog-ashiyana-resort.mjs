// node --env-file=.env.local scripts/add-blog-ashiyana-resort.mjs
import mongoose from 'mongoose';

const BlogSchema = new mongoose.Schema({
  title: String,
  slug: { type: String, unique: true },
  excerpt: String,
  content: String,
  coverImage: String,
  author: String,
  category: String,
  tags: [String],
  seoTitle: String,
  seoDescription: String,
  status: { type: String, default: 'draft' },
  publishedAt: Date,
  readTime: Number,
}, { timestamps: true });

const VENDOR_IMAGE = 'https://res.cloudinary.com/djaif7u83/image/upload/v1783059452/shaadishopping/ashiyana-resort/x2svqkmeyizqreenyaxg.webp';

const BLOG = {
  title: 'Ashiyana Resort, Rukanpura — Best Banquet Hall & Lawn Venue in Digha, Patna (2025 Guide)',
  slug: 'ashiyana-resort-banquet-hall-digha-patna',
  excerpt:
    'Looking for a wedding venue near Digha, Ashiyana Nagar, Patliputra, Kurji or Boring Road? Ashiyana Resort in Rukanpura offers an indoor banquet hall + outdoor lawn, 10 guest rooms, and per-plate pricing from ₹900 — here is the complete guide.',
  category: 'Venue Guides',
  author: 'ShaadiShopping Team',
  tags: [
    'ashiyana resort patna',
    'banquet hall in digha patna',
    'wedding venue digha patna',
    'banquet hall rukanpura patna',
    'marriage hall ashiyana nagar patna',
    'wedding venue patliputra patna',
    'banquet hall kurji patna',
    'marriage hall boring road patna',
    'wedding lawn west patna',
    'venue near don bosco school patna',
  ],
  seoTitle: 'Ashiyana Resort Rukanpura — Banquet Hall & Lawn in Digha, Patna | ShaadiShopping',
  seoDescription:
    'Ashiyana Resort in Rukanpura is West Patna\'s top-rated banquet hall and lawn venue for weddings — serving Digha, Ashiyana Nagar, Patliputra, Kurji & Boring Road. Per-plate pricing from ₹900, 10 guest rooms, indoor + outdoor space. Book via ShaadiShopping.',
  coverImage: VENDOR_IMAGE,
  status: 'published',
  publishedAt: new Date(),
  readTime: 7,
  content: `
<h2>West Patna's Most Loved Wedding Venue: Ashiyana Resort, Rukanpura</h2>
<p>If your family and guests live around <strong>Digha, Ashiyana Nagar, Patliputra, Kurji, or Boring Road</strong>, finding a wedding venue that's actually close to home makes a real difference — shorter travel for elderly relatives, easier logistics for multi-day functions, and no one stuck in Patna's traffic on the big day. <a href="/vendors/ashiyana-resort-rukanpura"><strong>Ashiyana Resort</strong></a> in Rukanpura has become the go-to banquet hall and lawn venue for exactly this reason, and it's rated <strong>5★</strong> by families who've celebrated there.</p>
<p>In this guide, we cover everything you need to know about Ashiyana Resort — location, capacity, pricing, features, and why it's our top recommendation for West Patna weddings — plus how to book it through <a href="/">ShaadiShopping</a>.</p>

<h2>Where Is Ashiyana Resort Located?</h2>
<p>Ashiyana Resort sits <strong>opposite Kali Mandir on Ashiana–Digha Road</strong>, near Don Bosco School, in Rukanpura, Patna — Bihar 800011. This puts it within a short, easy drive of several major West Patna localities:</p>
<ul>
  <li><strong>Digha</strong> — practically next door, along Ashiana–Digha Road</li>
  <li><strong>Ashiyana Nagar</strong> — a few minutes away</li>
  <li><strong>Patliputra Colony</strong> — well connected via the Digha–Ashiyana corridor</li>
  <li><strong>Kurji</strong> — a short, direct drive</li>
  <li><strong>Boring Road</strong> — easily reachable, no need to cross into central Patna</li>
</ul>
<p>For families and guests based anywhere in West Patna, Ashiyana Resort removes the need to travel to Bailey Road or the city centre for a wedding venue.</p>

<h2>Indoor Banquet Hall + Outdoor Lawn — One Venue, Two Settings</h2>
<p>What sets <a href="/vendors/ashiyana-resort-rukanpura">Ashiyana Resort</a> apart from most Patna banquet halls is that it offers <strong>both an indoor hall and an outdoor lawn on the same property</strong> — so you can choose the setting that suits your ceremony, or use both across a multi-function wedding.</p>
<ul>
  <li><strong>Indoor Banquet Hall:</strong> 300 guests seated, 450 maximum — fully usable in any season or weather</li>
  <li><strong>Outdoor Lawn:</strong> 400 guests seated, 600 maximum — ideal for baraat, hawan, and open-air receptions</li>
  <li><strong>4 AC changing rooms</strong> for the bride, groom, and family</li>
  <li><strong>10 guest rooms available onsite</strong> — a major advantage for families hosting relatives from outside Patna</li>
</ul>

<h2>Ashiyana Resort Pricing — Per Plate Packages</h2>
<table>
  <thead>
    <tr><th>Package</th><th>Price Per Plate</th><th>Includes</th></tr>
  </thead>
  <tbody>
    <tr><td>Vegetarian</td><td>₹900</td><td>Veg catering + hall or lawn access + parking</td></tr>
    <tr><td>Non-Vegetarian</td><td>₹1,000</td><td>Veg + Non-Veg catering + hall or lawn access + parking</td></tr>
  </tbody>
</table>
<p><em>18% F&amp;B taxes apply, and a 25% advance is required to confirm your booking date.</em></p>
<p>This makes Ashiyana Resort one of the most competitively priced full-service venues in West Patna — well below premium Bailey Road banquets, without compromising on space or facilities.</p>

<h2>What's Included at Ashiyana Resort</h2>
<ul>
  <li>Veg &amp; Non-Veg in-house catering</li>
  <li>In-house decoration available</li>
  <li><strong>Outside caterers allowed</strong> — bring your own if you have a preferred vendor</li>
  <li>Baraat, hawan, and firecrackers permitted</li>
  <li>Overnight weddings allowed — plan multi-day functions without a curfew</li>
  <li>Parking for 30 vehicles</li>
  <li>Operating hours: 11 AM – 4 PM and 6 PM – 12 AM</li>
</ul>
<p><em>Note: alcohol is not permitted on the premises.</em></p>

<h2>Why Ashiyana Resort Is the Top Pick for Each West Patna Locality</h2>

<h3>Digha</h3>
<p>Ashiyana Resort is practically a Digha address — right on Ashiana–Digha Road. If your wedding guest list is concentrated in Digha, this is the closest full-featured banquet hall and lawn venue available.</p>

<h3>Ashiyana Nagar</h3>
<p>A short drive from Ashiyana Nagar, this venue's indoor-outdoor combination and onsite guest rooms make it the natural choice for Ashiyana Nagar families planning a multi-day wedding.</p>

<h3>Patliputra Colony</h3>
<p>Patliputra families looking for a venue that avoids Bailey Road traffic will find Ashiyana Resort an easy, direct drive via the Digha–Ashiyana corridor — with pricing well below most Patliputra-area premium halls.</p>

<h3>Kurji</h3>
<p>For Kurji residents, Ashiyana Resort offers a nearby alternative to travelling into central Patna, with ample parking and both hall and lawn options for any guest count.</p>

<h3>Boring Road</h3>
<p>Boring Road families who want a spacious venue without the premium Boring Road pricing will find Ashiyana Resort a short, convenient drive away — with the added benefit of onsite guest rooms for outstation relatives.</p>

<h2>Ashiyana Resort — Frequently Asked Questions</h2>
<h3>Is Ashiyana Resort a good banquet hall in Patna?</h3>
<p>Ashiyana Resort is a 5★-rated banquet hall and lawn venue in Rukanpura, Digha, Patna, offering both indoor and outdoor settings for weddings. The hall seats up to 300 guests (450 max) and the lawn accommodates up to 400 seated (600 max), with 4 AC changing rooms and 10 onsite guest rooms.</p>
<h3>What is the per-plate price at Ashiyana Resort?</h3>
<p>Ashiyana Resort offers vegetarian catering at ₹900/plate and non-vegetarian at ₹1,000/plate, inclusive of hall or lawn access and parking. An 18% F&amp;B tax applies, and a 25% advance is required to book.</p>
<h3>Does Ashiyana Resort allow outside caterers and baraat?</h3>
<p>Yes — Ashiyana Resort allows outside caterers, and permits baraat, hawan, and firecrackers. Overnight weddings are also allowed. Alcohol is not permitted on the premises.</p>
<h3>How many guests can Ashiyana Resort accommodate?</h3>
<p>The indoor hall seats 300 (450 maximum) and the outdoor lawn seats 400 (600 maximum) — so Ashiyana Resort comfortably handles anything from an intimate ceremony to a large 600-guest celebration.</p>
<h3>Is Ashiyana Resort convenient for guests from Boring Road, Patliputra, or Kurji?</h3>
<p>Yes — Ashiyana Resort sits on Ashiana-Digha Road in Rukanpura, a short drive from Boring Road, Patliputra, Ashiyana Nagar, Digha, and Kurji, making it an easy venue for guests coming from across West Patna.</p>

<h2>Book Ashiyana Resort Through ShaadiShopping</h2>
<p>ShaadiShopping has personally verified Ashiyana Resort's pricing, capacity, and facilities. Enquire through ShaadiShopping for transparent per-plate pricing, help checking date availability, and a dedicated consultant to guide your booking — completely free for couples.</p>
<p>View full photos, packages, and reviews on the <a href="/vendors/ashiyana-resort-rukanpura">Ashiyana Resort venue page</a>, or browse <a href="/cities/patna/venue">all verified wedding venues in Patna</a>. For a free consultation, call or WhatsApp ShaadiShopping at <strong>+91 76460 28228</strong>.</p>
`.trim(),
};

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('❌  MONGODB_URI not found in .env.local'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('✅  Connected to MongoDB');

  const Blog = mongoose.models.Blog || mongoose.model('Blog', BlogSchema);

  const existing = await Blog.findOne({ slug: BLOG.slug });
  if (existing) {
    console.log('⚠️   Blog already exists — updating...');
    await Blog.findOneAndReplace({ slug: BLOG.slug }, BLOG, { upsert: true });
    console.log('✅  Blog updated:', BLOG.title);
  } else {
    await Blog.create(BLOG);
    console.log('✅  Blog created:', BLOG.title);
  }

  await mongoose.disconnect();
  console.log('🎉  Done! Blog is now live at /blog/ashiyana-resort-banquet-hall-digha-patna');
}

run().catch((err) => { console.error('❌  Error:', err.message); process.exit(1); });
