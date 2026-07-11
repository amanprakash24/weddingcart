import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

// Vercel serverless functions cap request bodies at 4.5 MB, too small for
// wedding-tour videos — so video files upload directly from the browser to
// Cloudinary using a short-lived signature from here, instead of proxying
// the file through our own API route like images do.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = 'shaadishopping/virtual-tours';
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET as string,
  );

  return NextResponse.json({
    success: true,
    signature,
    timestamp,
    folder,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
}
