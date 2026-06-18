// node --env-file=.env.local scripts/add-blog-banquet-hall-patna.mjs
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

const BLOG = {
  title: 'Best Banquet Halls in Patna for Weddings & Events — 2025 Guide',
  slug: 'best-banquet-hall-in-patna',
  excerpt:
    'Looking for the best banquet hall in Patna? We have listed the top banquet halls in Patna for weddings, receptions, and all celebrations — with real pricing, features, and expert tips to help you book the right hall.',
  category: 'Venue Guides',
  author: 'ShaadiShopping Team',
  tags: [
    'banquet hall in patna',
    'best banquet hall patna',
    'marriage hall patna',
    'wedding venue patna',
    'banquet hall rajeev nagar patna',
    'banquet hall danapur patna',
    'banquet hall judges colony patna',
    'banquet hall saguna mor patna',
    '7 vachan patna',
    'event hall patna',
  ],
  seoTitle: 'Best Banquet Hall in Patna for Wedding & Events — 2025 | ShaadiShopping',
  seoDescription:
    'Find the best banquet halls in Patna for your wedding, reception, or any celebration. Compare top venues like Touch of Cozy (Rajeev Nagar), 7 Vachan (Judges Colony) and Swayamvar Hall (Danapur) with real pricing and features.',
  coverImage: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=80',
  status: 'published',
  publishedAt: new Date(),
  readTime: 9,
  content: `
<h2>Why Choosing the Right Banquet Hall in Patna Matters</h2>
<p>Patna has grown into one of Bihar's most active wedding markets. Hundreds of weddings, receptions, engagements, and family functions happen across the city every week — and the banquet hall you choose sets the tone for the entire event. The right hall means comfortable guests, seamless catering, hassle-free parking, and memories that last a lifetime. The wrong one means chaos on the most important day of your family's life.</p>
<p>At <a href="/">ShaadiShopping</a>, we work with verified banquet halls across Patna every day. In this guide, we share the top banquet halls in Patna, what makes each special, what to look for before booking, and a transparent pricing breakdown — so you can make the right decision with confidence.</p>

<h2>Top Banquet Halls in Patna — Our Picks for 2025</h2>

<h3>1. Touch of Cozy — Mica Colony, Rajeev Nagar</h3>
<p><a href="/lp/touch-of-cozy"><strong>Touch of Cozy</strong></a> is one of Patna's most talked-about new banquet halls — and for good reason. Located in Mica Colony, Road No. 23, Rajeev Nagar, this venue combines a fully air-conditioned banquet hall, an in-house café, and <strong>5 complimentary guest rooms</strong> under one roof. It is ideal for families who need overnight accommodation for out-of-town relatives.</p>
<p>What makes Touch of Cozy stand out:</p>
<ul>
  <li>In-house catering with 6 packages ranging from <strong>₹999 to ₹1,599 per plate</strong> (veg and non-veg)</li>
  <li>LED Counter available on Platinum and Luxury packages</li>
  <li>Valet parking for 40–45 vehicles</li>
  <li>Baraat permitted and overnight weddings supported</li>
  <li>FSSAI certified kitchen — food safety guaranteed</li>
  <li>GST registered — fully compliant billing</li>
  <li>Operating hours: 11 AM to 12 AM daily</li>
</ul>
<p><strong>Best for:</strong> Weddings, receptions, engagements, birthdays, and corporate events where you want an all-in-one venue with catering and stay.</p>
<p><strong>Starting price:</strong> ₹999 per plate (Veg Gold package)</p>
<p><strong>Contact &amp; booking:</strong> <a href="/lp/touch-of-cozy">View Touch of Cozy on ShaadiShopping</a></p>

<h3>2. Swayamvar Hall &amp; Homestay — Danapur, Patna</h3>
<p><a href="/lp/swayamvar-hall"><strong>Swayamvar Hall &amp; Homestay</strong></a> is a well-established banquet venue in Danapur, located at T Point, Gola Road, near Chanakya Puri. It has earned a strong reputation over the years for hosting large weddings and multi-day celebrations with professional service.</p>
<p>What makes Swayamvar Hall stand out:</p>
<ul>
  <li>Large capacity — suitable for gatherings of 500+ guests</li>
  <li>Home stay accommodation available — perfect for multi-day events</li>
  <li>Fully air-conditioned hall with modern sound and lighting setup</li>
  <li>In-house catering and decoration teams</li>
  <li>Ample parking space</li>
  <li>Conveniently located near Danapur — well connected from all parts of Patna</li>
</ul>
<p><strong>Best for:</strong> Large weddings, baraats, multi-day celebrations where you need accommodation on-site for family members.</p>
<p><strong>Contact &amp; booking:</strong> <a href="/lp/swayamvar-hall">View Swayamvar Hall on ShaadiShopping</a></p>

<h3>3. 7 Vachan — Judges Colony, Saguna Mor, Patna</h3>
<p><a href="/lp/7-vachan-patna"><strong>7 Vachan</strong></a> is an established and highly rated banquet hall located in Judges Colony, near Saguna Mor on the Danapur Khagaul Road. Rated <strong>4.6★ across 55 reviews</strong>, it has built a strong reputation since 2016 for delivering professional wedding and event services at honest per-plate pricing. With a rooftop venue option and <strong>7 on-site guest rooms</strong>, 7 Vachan is a complete wedding venue for families with outstation guests.</p>
<p>What makes 7 Vachan stand out:</p>
<ul>
  <li>In-house catering at <strong>₹1,100/plate (Veg)</strong> and <strong>₹1,300/plate (Non-Veg)</strong></li>
  <li>7 guest rooms — ideal for outstation families</li>
  <li>In-house DJ — no need to arrange separately</li>
  <li>Rooftop venue option for outdoor ceremonies</li>
  <li>Play area for kids</li>
  <li>Wheelchair accessible</li>
  <li>500+ guest capacity</li>
  <li>Ample on-site parking</li>
  <li>Established in 2016 — nearly a decade of trust</li>
</ul>
<p><strong>Best for:</strong> Weddings, receptions, engagements, birthday parties, baby showers, and corporate events for families who want in-house DJ, catering, and stay under one roof.</p>
<p><strong>Starting price:</strong> ₹1,100 per plate (Veg)</p>
<p><strong>Contact &amp; booking:</strong> <a href="/lp/7-vachan-patna">View 7 Vachan on ShaadiShopping</a></p>

<h2>Types of Banquet Halls in Patna</h2>
<p>Patna's banquet market offers several categories of venues depending on your guest count, budget, and the kind of event you are hosting.</p>

<h3>Small Banquet Halls (100–250 guests)</h3>
<p>Compact halls in neighbourhoods like Rajendra Nagar, Boring Road, Kankarbagh, and Rajeev Nagar are ideal for intimate functions — engagements, birthday parties, anniversary dinners, and small receptions. These halls typically include basic decoration, in-house catering, and parking for 20–30 vehicles.</p>
<p><strong>Typical price:</strong> ₹70,000 – ₹1,50,000 per event, or ₹900–₹1,200 per plate all-inclusive.</p>

<h3>Mid-Size Banquet Halls (250–500 guests)</h3>
<p>The most popular category in Patna for weddings and receptions. Halls in Danapur, Phulwari Sharif, and Patna City fall here. Most offer full decoration, in-house catering, sound systems, backup power, and valet parking.</p>
<p><strong>Typical price:</strong> ₹1,20,000 – ₹2,50,000 per event, or ₹1,000–₹1,400 per plate all-inclusive.</p>

<h3>Large Banquet Halls &amp; Convention Centres (500+ guests)</h3>
<p>For grand weddings with 500 to 1,000+ guests, Patna has several large convention-style venues along the Bypass Road, in Anisabad, and near the Airport Road. These venues support multi-day functions, large baraats, and simultaneous event spaces.</p>
<p><strong>Typical price:</strong> ₹2,50,000 – ₹5,00,000 per event, or ₹1,200–₹1,800 per plate all-inclusive.</p>

<h2>Banquet Hall Pricing in Patna — 2025 Comparison</h2>
<table>
  <thead>
    <tr><th>Package Type</th><th>Price Per Plate</th><th>Includes</th></tr>
  </thead>
  <tbody>
    <tr><td>Veg Basic</td><td>₹800 – ₹1,000</td><td>Hall + Basic Décor + Veg Catering</td></tr>
    <tr><td>Veg Premium</td><td>₹1,000 – ₹1,400</td><td>Hall + Enhanced Décor + LED Counter + Veg Catering</td></tr>
    <tr><td>Non-Veg Basic</td><td>₹1,000 – ₹1,200</td><td>Hall + Décor + Non-Veg Catering</td></tr>
    <tr><td>Non-Veg Premium</td><td>₹1,200 – ₹1,600</td><td>Hall + Premium Décor + LED Counter + Non-Veg Catering</td></tr>
    <tr><td>Luxury (Veg/Non-Veg)</td><td>₹1,400 – ₹1,800</td><td>Hall + Luxury Décor + Mocktails + Welcome Drinks + Full Menu</td></tr>
  </tbody>
</table>
<p><em>Prices are per plate and generally include hall rental, basic decoration, and catering. Confirm individually with each venue.</em></p>

<h2>Which Areas of Patna Have the Best Banquet Halls?</h2>

<h3>Rajeev Nagar / Mica Colony</h3>
<p>A fast-growing residential and commercial belt in Patna. Banquet halls here are newer, well-maintained, and offer excellent value. <a href="/lp/touch-of-cozy">Touch of Cozy</a> is the standout choice in this area — with its café, guest rooms, and competitive per-plate pricing.</p>

<h3>Danapur</h3>
<p>One of Patna's most active wedding zones. Danapur's banquet halls are well-established and handle high guest volumes efficiently. <a href="/lp/swayamvar-hall">Swayamvar Hall</a> on Gola Road is the go-to name here, especially for large baraats and multi-day functions.</p>

<h3>Judges Colony / Saguna Mor</h3>
<p>Located along the Danapur Khagaul Road, Judges Colony and Saguna Mor are emerging as a preferred wedding belt for families in the western outskirts of Patna. <a href="/lp/7-vachan-patna">7 Vachan</a> is the leading banquet hall here — offering in-house DJ, 7 guest rooms, a rooftop venue, and transparent per-plate pricing that has earned it a 4.6★ rating across 55 reviews.</p>

<h3>Kankarbagh</h3>
<p>Centrally located with good road connectivity. Popular for mid-size weddings and corporate events. Halls here are competitively priced and easily accessible from Patna Junction.</p>

<h3>Boring Road / Patliputra Colony</h3>
<p>Upscale neighbourhood with banquet halls that cater to premium weddings and receptions. Expect higher per-plate pricing but also better service standards and décor quality.</p>

<h3>Bailey Road</h3>
<p>A long stretch with several large wedding venues and hotel banquets. Ideal for families looking for prestige venues with accommodation for outstation guests.</p>

<h2>What to Check Before Booking a Banquet Hall in Patna</h2>
<ol>
  <li><strong>Actual seating capacity</strong> — Always ask for seated dinner capacity, not just standing capacity. A hall that "fits 500" often seats 300 comfortably for a dinner.</li>
  <li><strong>Catering policy</strong> — Many Patna halls insist on in-house catering only. If you have a preferred outside caterer, confirm this before signing.</li>
  <li><strong>Parking</strong> — Patna roads are busy. A hall without adequate parking creates stress for guests. Confirm the vehicle count clearly.</li>
  <li><strong>Generator backup</strong> — Power cuts happen. Ask specifically whether the generator covers the entire hall including AC, lights, and sound — or only partial backup.</li>
  <li><strong>Decoration policy</strong> — Some halls have tie-ups with specific decorators. Confirm whether you can bring your own.</li>
  <li><strong>Outside food policy</strong> — Many halls insist on in-house caterers only. Confirm before booking if you have a preferred vendor.</li>
  <li><strong>Muhurat date availability</strong> — Popular November–January muhurats get booked 6–8 months in advance. Lock in your date as soon as you finalise it.</li>
  <li><strong>Guest rooms</strong> — If you have outstation family, venues like <a href="/lp/touch-of-cozy">Touch of Cozy</a> (5 rooms), <a href="/lp/7-vachan-patna">7 Vachan</a> (7 rooms), and <a href="/lp/swayamvar-hall">Swayamvar Hall</a> offer on-site accommodation that saves significant coordination cost.</li>
</ol>

<h2>When to Book Your Banquet Hall in Patna</h2>
<p>The wedding season in Bihar peaks between <strong>October and February</strong>. November, December, and January are the busiest months with the most auspicious muhurats. During this period, top banquet halls in Patna book up <strong>4 to 8 months in advance</strong>.</p>
<p>If your wedding or event falls in this window, start your search immediately. Off-season months (March–July) offer more availability and often better pricing, though summer heat rules out outdoor venue options entirely.</p>

<h2>Book a Banquet Hall in Patna Through ShaadiShopping</h2>
<p>ShaadiShopping is Patna's trusted wedding planning platform. We have personally verified every banquet hall we list — from the quality of catering to the reliability of their parking and power backup. When you enquire through ShaadiShopping, you get transparent pricing, expert guidance, and a dedicated consultant who helps you negotiate and confirm the best deal.</p>
<p>Browse <a href="/categories/venue">all verified wedding venues in Patna</a> or <a href="/plan">start your free wedding consultation</a> today — our Patna team responds within 30 minutes.</p>
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
  console.log('🎉  Done! Blog is now live at /blog/best-banquet-hall-in-patna');
}

run().catch((err) => { console.error('❌  Error:', err.message); process.exit(1); });
