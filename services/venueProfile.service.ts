import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { effectiveScope } from '@/lib/ownership/scope';
import { PLATFORM_BUSINESS_ID } from '@/lib/ownership/owned';
import { isOwnUpload, missingProfileSteps, PROFILE_LIMITS, validateProfile, videoLink, type ProfileErrors, type ProfileStep } from '@/lib/venue/profile';

// The business profile a vendor completes on first sign-in (6 Oct 2026): name, logo, photos, an optional video and GST number.
//
// Two halves, kept apart on purpose:
//  - `venueProfileService` — the vendor's own side. Always called inside the vendor's scope (lib/ownership/venueEntry.ts): the
//    business is the scope's, never one named by a request. Only the Owner changes it.
//  - `profileReviewService` — Shaadi Shopping's side: a photo or video reaches the PUBLIC listing only after an admin approves it.
//    The business's own quotations and proposal links may use its media straight away.
//
// Business and BusinessPhoto are not owned tables, so EVERY read and write here names the business itself.

// Where the upload routes put profile media. isOwnUpload() accepts nothing else — a media address is never taken on trust.
export const PROFILE_UPLOAD_FOLDER = 'shaadishopping/vendor-profile';
const cloudName = () => process.env.CLOUDINARY_CLOUD_NAME ?? '';

type PhotoStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ProfileView {
  name: string;
  logoUrl: string | null;
  gstin: string | null;
  video: { url: string; isLink: boolean; status: PhotoStatus } | null;
  photos: { id: string; url: string; status: PhotoStatus }[];
  missing: ProfileStep[]; // empty = the profile is complete
  canEdit: boolean;
  limits: { photosMin: number; photosMax: number };
}

export type ProfileResult = ProfileView | { errors: ProfileErrors } | { forbidden: true };

type Db = Pick<typeof prisma, 'business' | 'businessPhoto' | 'vendor'>;
export interface VenueProfileDeps {
  db: Db;
  cloudName: () => string;
  now: () => Date;
}
const defaultDeps = (): VenueProfileDeps => ({ db: prisma, cloudName, now: () => new Date() });

const businessSelect = { id: true, kind: true, name: true, logoUrl: true, gstin: true, videoUrl: true, videoStatus: true, vendorId: true } as const;
const photoSelect = { id: true, url: true, status: true } as const;

export function createVenueProfileService(deps: VenueProfileDeps = defaultDeps()) {
  // The vendor business this work runs as. Shaadi Shopping itself has no profile here.
  async function current() {
    const scope = effectiveScope();
    if (scope.kind !== 'BUSINESS' || scope.businessId === PLATFORM_BUSINESS_ID) throw new NotFoundError('Business', 'current');
    const business = await deps.db.business.findUnique({ where: { id: scope.businessId }, select: businessSelect });
    if (!business || business.kind !== 'VENDOR') throw new NotFoundError('Business', scope.businessId);
    return { business, canEdit: scope.role === 'OWNER' };
  }

  const ours = (url: unknown): url is string => isOwnUpload(url, deps.cloudName(), PROFILE_UPLOAD_FOLDER);

  async function get(): Promise<ProfileView> {
    const { business: b, canEdit } = await current();
    const photos = await deps.db.businessPhoto.findMany({ where: { businessId: b.id }, select: photoSelect, orderBy: { createdAt: 'asc' } });
    return {
      name: b.name,
      logoUrl: b.logoUrl,
      gstin: b.gstin,
      video: b.videoUrl ? { url: b.videoUrl, isLink: !ours(b.videoUrl), status: b.videoStatus ?? 'PENDING' } : null,
      photos,
      missing: missingProfileSteps({ name: b.name, logoUrl: b.logoUrl, photoCount: photos.length }),
      canEdit,
      limits: { photosMin: PROFILE_LIMITS.photosMin, photosMax: PROFILE_LIMITS.photosMax },
    };
  }

  // Every change goes through here: the Owner only, then the fresh profile.
  async function change(work: (business: Awaited<ReturnType<typeof current>>['business']) => Promise<void | { errors: ProfileErrors }>): Promise<ProfileResult> {
    const { business, canEdit } = await current();
    if (!canEdit) return { forbidden: true };
    const refused = await work(business);
    return refused ?? get();
  }

  return {
    get,

    // Is the profile complete? For the gate in front of the dashboard — one cheap read each.
    async missing(): Promise<ProfileStep[]> {
      const { business: b } = await current();
      return missingProfileSteps({ name: b.name, logoUrl: b.logoUrl, photoCount: await deps.db.businessPhoto.count({ where: { businessId: b.id } }) });
    },

    // The typed fields: the business name and the GST number.
    update: (input: Record<string, unknown>) =>
      change(async (b) => {
        const checked = validateProfile({ name: input.name, gstin: input.gstin });
        if (!checked.ok) return { errors: checked.errors };
        await deps.db.business.update({ where: { id: b.id }, data: { name: checked.value.name, gstin: checked.value.gstin } });
      }),

    setLogo: (url: unknown) =>
      change(async (b) => {
        if (!ours(url)) throw new ValidationError('That logo did not upload properly — please try again');
        await deps.db.business.update({ where: { id: b.id }, data: { logoUrl: url } });
      }),

    addPhoto: (url: unknown) =>
      change(async (b) => {
        if (!ours(url)) throw new ValidationError('That photo did not upload properly — please try again');
        if ((await deps.db.businessPhoto.count({ where: { businessId: b.id } })) >= PROFILE_LIMITS.photosMax) {
          throw new ConflictError(`You can keep up to ${PROFILE_LIMITS.photosMax} photos — remove one to add another`);
        }
        await deps.db.businessPhoto.create({ data: { businessId: b.id, url } });
      }),

    // Removing a photo also takes it off the public listing, if it had been approved onto it.
    removePhoto: (photoId: string) =>
      change(async (b) => {
        const photo = await deps.db.businessPhoto.findFirst({ where: { id: photoId, businessId: b.id }, select: { url: true, status: true } });
        if (!photo) throw new NotFoundError('Photo', photoId);
        await deps.db.businessPhoto.deleteMany({ where: { id: photoId, businessId: b.id } });
        if (photo.status === 'APPROVED' && b.vendorId) {
          const vendor = await deps.db.vendor.findUnique({ where: { id: b.vendorId }, select: { images: true } });
          if (vendor?.images.includes(photo.url)) await deps.db.vendor.update({ where: { id: b.vendorId }, data: { images: vendor.images.filter((u) => u !== photo.url) } });
        }
      }),

    // The video: one of our own uploads, or a YouTube / Instagram link (no storage). A new one waits for approval again.
    setVideo: (input: unknown) =>
      change(async (b) => {
        const url = ours(input) ? input : videoLink(input);
        if (!url) return { errors: { videoLink: 'Paste a link to your video on YouTube or Instagram (starting with https://)' } };
        await deps.db.business.update({ where: { id: b.id }, data: { videoUrl: url, videoStatus: 'PENDING' } });
      }),

    removeVideo: () =>
      change(async (b) => {
        const was = b.videoUrl;
        const wasPublic = b.videoStatus === 'APPROVED';
        await deps.db.business.update({ where: { id: b.id }, data: { videoUrl: null, videoStatus: null } });
        if (was && wasPublic && b.vendorId) {
          const vendor = await deps.db.vendor.findUnique({ where: { id: b.vendorId }, select: { virtualTourVideo: true } });
          if (vendor?.virtualTourVideo === was) await deps.db.vendor.update({ where: { id: b.vendorId }, data: { virtualTourVideo: '' } });
        }
      }),
  };
}

export const venueProfileService = createVenueProfileService();

// ---- Shaadi Shopping's side: what may appear on the public listing ----

export interface PendingMedia {
  photos: { id: string; url: string; businessName: string; uploadedAt: string }[];
  videos: { businessId: string; url: string; isLink: boolean; businessName: string }[];
}

export function createProfileReviewService(deps: VenueProfileDeps = defaultDeps()) {
  const ours = (url: string) => isOwnUpload(url, deps.cloudName(), PROFILE_UPLOAD_FOLDER);

  return {
    // Everything waiting for a decision, oldest first.
    async pending(): Promise<PendingMedia> {
      const [photos, videos] = await Promise.all([
        deps.db.businessPhoto.findMany({ where: { status: 'PENDING' }, select: { id: true, url: true, createdAt: true, business: { select: { name: true } } }, orderBy: { createdAt: 'asc' }, take: 200 }),
        deps.db.business.findMany({ where: { videoStatus: 'PENDING', videoUrl: { not: null } }, select: { id: true, name: true, videoUrl: true }, orderBy: { updatedAt: 'asc' }, take: 100 }),
      ]);
      return {
        photos: photos.map((p) => ({ id: p.id, url: p.url, businessName: p.business.name, uploadedAt: p.createdAt.toISOString() })),
        videos: videos.map((v) => ({ businessId: v.id, url: v.videoUrl as string, isLink: !ours(v.videoUrl as string), businessName: v.name })),
      };
    },

    // Approve → the photo joins the public listing's gallery. Reject → it never does; the business keeps it for its own documents.
    async reviewPhoto(photoId: string, approve: boolean): Promise<void> {
      const photo = await deps.db.businessPhoto.findUnique({ where: { id: photoId }, select: { id: true, url: true, status: true, business: { select: { vendorId: true } } } });
      if (!photo) throw new NotFoundError('Photo', photoId);
      // Only a waiting photo: a second click, or a decision made meanwhile by someone else, changes nothing.
      const decided = await deps.db.businessPhoto.updateMany({ where: { id: photoId, status: 'PENDING' }, data: { status: approve ? 'APPROVED' : 'REJECTED', reviewedAt: deps.now() } });
      if (decided.count !== 1 || !approve || !photo.business.vendorId) return;
      const vendor = await deps.db.vendor.findUnique({ where: { id: photo.business.vendorId }, select: { images: true } });
      if (vendor && !vendor.images.includes(photo.url)) await deps.db.vendor.update({ where: { id: photo.business.vendorId }, data: { images: [...vendor.images, photo.url] } });
    },

    // Approve → an uploaded video becomes the listing's video (a link is only marked approved: the listing plays files, not links).
    async reviewVideo(businessId: string, approve: boolean): Promise<void> {
      const business = await deps.db.business.findUnique({ where: { id: businessId }, select: { videoUrl: true, videoStatus: true, vendorId: true } });
      if (!business?.videoUrl) throw new NotFoundError('Video', businessId);
      const decided = await deps.db.business.updateMany({ where: { id: businessId, videoStatus: 'PENDING', videoUrl: business.videoUrl }, data: { videoStatus: approve ? 'APPROVED' : 'REJECTED' } });
      if (decided.count !== 1 || !approve || !business.vendorId || !ours(business.videoUrl)) return;
      await deps.db.vendor.update({ where: { id: business.vendorId }, data: { virtualTourVideo: business.videoUrl } });
    },
  };
}

export const profileReviewService = createProfileReviewService();
