// node --env-file=.env.local scripts/fix-touch-of-cozy-blog-cta.mjs
import mongoose from 'mongoose';

const BlogSchema = new mongoose.Schema({}, { strict: false });

const SLUG = 'touch-of-cozy-patna-review-best-banquet-hall-rajeev-nagar';

const OLD_TEXT = '<p>Visit <a href="/lp/touch-of-cozy">shaadishopping.com/lp/touch-of-cozy</a>, fill the free quote form, or call <strong>+91-76460-28228</strong>. Our expert will check date availability and confirm pricing on the same day.</p>';

const NEW_TEXT = `<div style="background:#FFFAF5;border-left:4px solid #C5A46D;padding:18px 22px;border-radius:8px;margin:20px 0;">
  <p style="margin:0 0 6px;font-size:1rem;font-weight:700;color:#2A1F1B;">Ready to Book Touch of Cozy?</p>
  <p style="margin:0;font-size:0.93rem;color:#555;line-height:1.65;">To check date availability and get a personalised quote, <a href="/lp/touch-of-cozy" style="color:#8B1A4A;font-weight:600;text-decoration:underline;">enquire on our Touch of Cozy page</a> or call us at <strong style="color:#2A1F1B;">+91 76460 28228</strong>. Our Patna team will confirm availability and share pricing on the same day — at no charge to you.</p>
</div>`;

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);
  const Blog = mongoose.model('Blog', BlogSchema);
  const blog = await Blog.findOne({ slug: SLUG });

  if (!blog) { console.error('Blog not found'); process.exit(1); }

  if (!blog.content.includes('shaadishopping.com/lp/touch-of-cozy')) {
    console.log('Text not found — may already be updated. Showing section:');
    const idx = blog.content.indexOf('How to Book');
    console.log(blog.content.slice(idx, idx + 500));
    await mongoose.disconnect();
    return;
  }

  const newContent = blog.content.replace(OLD_TEXT, NEW_TEXT);
  await Blog.findOneAndUpdate({ slug: SLUG }, { content: newContent });
  console.log('Blog CTA updated successfully');
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err.message); process.exit(1); });
