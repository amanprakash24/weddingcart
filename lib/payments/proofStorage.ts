import { v2 as cloudinary } from 'cloudinary';

// Payment proof screenshots (Roadmap 1.3, 08-quotation.md §20). They can show the couple's bank name, account and balance, so they are
// uploaded as PRIVATE Cloudinary assets: there is no public URL. Staff get a signed link that expires in minutes; the couple never
// gets one back.

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const FOLDER = 'payment-proofs';
const LINK_MINUTES = 10;

export interface StoredProof {
  publicId: string;
  format: string;
}

export async function uploadProof(bytes: Buffer): Promise<StoredProof> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: FOLDER, type: 'private', resource_type: 'image' }, (error, res) => {
        if (error || !res) reject(error ?? new Error('Upload failed'));
        else resolve({ publicId: res.public_id, format: res.format });
      })
      .end(bytes);
  });
}

// Best effort: used when the submission could not be saved after the file went up, so no orphan proof is kept.
export async function deleteProof(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { type: 'private', resource_type: 'image' });
  } catch (err) {
    console.error('payment proof clean-up failed:', err instanceof Error ? err.message : err);
  }
}

export function signedProofUrl(proof: StoredProof, now: Date = new Date()): string {
  return cloudinary.utils.private_download_url(proof.publicId, proof.format, {
    resource_type: 'image',
    type: 'private',
    expires_at: Math.floor(now.getTime() / 1000) + LINK_MINUTES * 60,
  });
}
