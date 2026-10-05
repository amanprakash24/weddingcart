/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { runInScope, type Scope } from '@/lib/ownership/scope';

// Both halves of the profile against an in-memory database passed in as a dependency — no shared module is mocked except
// '@/lib/prisma', which importing the service would otherwise load for real.
mock.module('@/lib/prisma', () => ({ prisma: {} }));
const { createVenueProfileService, createProfileReviewService, PROFILE_UPLOAD_FOLDER } = await import('./venueProfile.service');

const CLOUD = 'democloud';
const NOW = new Date('2026-10-06T10:00:00Z');
const ownImage = (name: string) => `https://res.cloudinary.com/${CLOUD}/image/upload/v1/${PROFILE_UPLOAD_FOLDER}/${name}.jpg`;
const ownVideo = `https://res.cloudinary.com/${CLOUD}/video/upload/v1/${PROFILE_UPLOAD_FOLDER}/tour.mp4`;

type Business = { id: string; kind: string; name: string; logoUrl: string | null; gstin: string | null; videoUrl: string | null; videoStatus: string | null; vendorId: string | null; updatedAt: Date };
type Photo = { id: string; businessId: string; url: string; status: string; reviewedAt: Date | null; createdAt: Date };
type Vendor = { id: string; images: string[]; virtualTourVideo: string };

let businesses: Business[];
let photos: Photo[];
let vendors: Vendor[];
let seq = 0;

const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
  Object.entries(where).every(([k, v]) => (v && typeof v === 'object' && 'not' in (v as object) ? row[k] !== (v as { not: unknown }).not : row[k] === v));

const db = {
  business: {
    // Copies, as a real database returns: a row read earlier never changes under the caller.
    findUnique: async (a: { where: { id: string } }) => {
      const b = businesses.find((x) => x.id === a.where.id);
      return b ? { ...b } : null;
    },
    findMany: async (a: { where: Record<string, unknown> }) => businesses.filter((b) => matches(b, a.where)).map((b) => ({ ...b })),
    update: async (a: { where: { id: string }; data: Partial<Business> }) => Object.assign(businesses.find((b) => b.id === a.where.id)!, a.data),
    updateMany: async (a: { where: Record<string, unknown>; data: Partial<Business> }) => {
      const hit = businesses.filter((b) => matches(b, a.where));
      hit.forEach((b) => Object.assign(b, a.data));
      return { count: hit.length };
    },
  },
  businessPhoto: {
    findMany: async (a: { where: Record<string, unknown> }) =>
      photos.filter((p) => matches(p, a.where)).sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime()).map((p) => ({ ...p, business: { name: businesses.find((b) => b.id === p.businessId)!.name } })),
    findFirst: async (a: { where: Record<string, unknown> }) => photos.find((p) => matches(p, a.where)) ?? null,
    findUnique: async (a: { where: { id: string } }) => {
      const p = photos.find((x) => x.id === a.where.id);
      return p ? { ...p, business: { vendorId: businesses.find((b) => b.id === p.businessId)!.vendorId } } : null;
    },
    count: async (a: { where: Record<string, unknown> }) => photos.filter((p) => matches(p, a.where)).length,
    create: async (a: { data: { businessId: string; url: string } }) => {
      const row: Photo = { id: `ph${++seq}`, status: 'PENDING', reviewedAt: null, createdAt: new Date(NOW.getTime() + seq), ...a.data };
      photos.push(row);
      return row;
    },
    deleteMany: async (a: { where: Record<string, unknown> }) => {
      const before = photos.length;
      photos = photos.filter((p) => !matches(p, a.where));
      return { count: before - photos.length };
    },
    updateMany: async (a: { where: Record<string, unknown>; data: Partial<Photo> }) => {
      const hit = photos.filter((p) => matches(p, a.where));
      hit.forEach((p) => Object.assign(p, a.data));
      return { count: hit.length };
    },
  },
  vendor: {
    findUnique: async (a: { where: { id: string } }) => vendors.find((v) => v.id === a.where.id) ?? null,
    update: async (a: { where: { id: string }; data: Partial<Vendor> }) => Object.assign(vendors.find((v) => v.id === a.where.id)!, a.data),
  },
};

const deps = { db: db as never, cloudName: () => CLOUD, now: () => NOW };
const profile = createVenueProfileService(deps);
const review = createProfileReviewService(deps);

const owner = (businessId: string): Scope => ({ kind: 'BUSINESS', businessId, role: 'OWNER' });
const staff = (businessId: string): Scope => ({ kind: 'BUSINESS', businessId, role: 'STAFF' });
const asOwnerA = <T>(fn: () => Promise<T>) => runInScope(owner('biz-a'), fn);
const asOwnerB = <T>(fn: () => Promise<T>) => runInScope(owner('biz-b'), fn);

beforeEach(() => {
  seq = 0;
  businesses = [
    { id: 'biz-a', kind: 'VENDOR', name: 'Swayamvar Hall', logoUrl: null, gstin: null, videoUrl: null, videoStatus: null, vendorId: 'ven-a', updatedAt: NOW },
    { id: 'biz-b', kind: 'VENDOR', name: 'Green Lawn', logoUrl: null, gstin: null, videoUrl: null, videoStatus: null, vendorId: 'ven-b', updatedAt: NOW },
    { id: 'shaadi-shopping', kind: 'PLATFORM', name: 'Shaadi Shopping', logoUrl: null, gstin: null, videoUrl: null, videoStatus: null, vendorId: null, updatedAt: NOW },
  ];
  photos = [];
  vendors = [
    { id: 'ven-a', images: ['https://old.example/a.jpg'], virtualTourVideo: '' },
    { id: 'ven-b', images: [], virtualTourVideo: '' },
  ];
});

describe('the vendor’s own profile', () => {
  test('a new business has its name from registration and still needs a logo and photos', async () => {
    const p = await asOwnerA(() => profile.get());
    expect(p).toMatchObject({ name: 'Swayamvar Hall', logoUrl: null, gstin: null, video: null, photos: [], missing: ['logo', 'photos'], canEdit: true });
    expect(await asOwnerA(() => profile.missing())).toEqual(['logo', 'photos']);
  });

  test('name and GST number: saved clean; a wrong GST number is explained and nothing is saved', async () => {
    expect(await asOwnerA(() => profile.update({ name: '  Swayamvar   Hall & Lawns ', gstin: '27aapfu0939f1zv' }))).toMatchObject({ name: 'Swayamvar Hall & Lawns', gstin: '27AAPFU0939F1ZV' });
    expect(await asOwnerA(() => profile.update({ name: 'Swayamvar Hall', gstin: '27AAPFU0939F1ZW' }))).toEqual({ errors: { gstin: expect.any(String) } });
    expect(businesses[0]).toMatchObject({ name: 'Swayamvar Hall & Lawns', gstin: '27AAPFU0939F1ZV' });
    expect(await asOwnerA(() => profile.update({ name: 'Swayamvar Hall', gstin: '' }))).toMatchObject({ gstin: null });
  });

  test('logo, then three photos → the profile is complete', async () => {
    await asOwnerA(() => profile.setLogo(ownImage('logo')));
    for (const n of ['p1', 'p2']) await asOwnerA(() => profile.addPhoto(ownImage(n)));
    expect(await asOwnerA(() => profile.missing())).toEqual(['photos']);
    const done = await asOwnerA(() => profile.addPhoto(ownImage('p3')));
    expect(done).toMatchObject({ logoUrl: ownImage('logo'), missing: [] });
    expect('photos' in done && done.photos.map((p) => p.status)).toEqual(['PENDING', 'PENDING', 'PENDING']);
  });

  test('only our own uploads are ever saved — any other address is refused', async () => {
    for (const bad of ['https://evil.example/logo.png', `https://res.cloudinary.com/othercloud/image/upload/v1/${PROFILE_UPLOAD_FOLDER}/x.jpg`, `https://res.cloudinary.com/${CLOUD}/image/upload/v1/shaadishopping/vendor-onboarding/x.jpg`, '', null]) {
      await expect(asOwnerA(() => profile.setLogo(bad))).rejects.toThrow('did not upload properly');
      await expect(asOwnerA(() => profile.addPhoto(bad))).rejects.toThrow('did not upload properly');
    }
    expect(businesses[0].logoUrl).toBeNull();
    expect(photos).toEqual([]);
  });

  test('at most 12 photos', async () => {
    for (let i = 0; i < 12; i++) await asOwnerA(() => profile.addPhoto(ownImage(`p${i}`)));
    await expect(asOwnerA(() => profile.addPhoto(ownImage('one-too-many')))).rejects.toThrow('up to 12 photos');
    expect(photos).toHaveLength(12);
  });

  test('the video: our own upload or a YouTube / Instagram link — anything else is explained', async () => {
    expect(await asOwnerA(() => profile.setVideo('https://vimeo.com/1'))).toEqual({ errors: { videoLink: expect.any(String) } });
    expect(await asOwnerA(() => profile.setVideo('https://youtu.be/abc123'))).toMatchObject({ video: { url: 'https://youtu.be/abc123', isLink: true, status: 'PENDING' } });
    expect(await asOwnerA(() => profile.setVideo(ownVideo))).toMatchObject({ video: { url: ownVideo, isLink: false, status: 'PENDING' } });
    expect(await asOwnerA(() => profile.removeVideo())).toMatchObject({ video: null });
    expect(businesses[0]).toMatchObject({ videoUrl: null, videoStatus: null });
  });

  test('each business has its own profile — one cannot touch the other’s photo', async () => {
    await asOwnerA(() => profile.addPhoto(ownImage('a1')));
    await expect(asOwnerB(() => profile.removePhoto(photos[0].id))).rejects.toThrow();
    expect(photos).toHaveLength(1);
    expect((await asOwnerB(() => profile.get())).photos).toEqual([]);
  });

  test('staff see the profile but cannot change it', async () => {
    const asStaff = <T>(fn: () => Promise<T>) => runInScope(staff('biz-a'), fn);
    expect((await asStaff(() => profile.get())).canEdit).toBe(false);
    for (const attempt of [() => profile.update({ name: 'Hacked' }), () => profile.setLogo(ownImage('logo')), () => profile.addPhoto(ownImage('p')), () => profile.setVideo(ownVideo), () => profile.removeVideo()]) {
      expect(await asStaff(attempt)).toEqual({ forbidden: true });
    }
    expect(businesses[0]).toMatchObject({ name: 'Swayamvar Hall', logoUrl: null, videoUrl: null });
    expect(photos).toEqual([]);
  });

  test('Shaadi Shopping itself has no profile here', async () => {
    await expect(runInScope(owner('shaadi-shopping'), () => profile.get())).rejects.toThrow();
  });
});

describe('Shaadi Shopping’s review — what reaches the public listing', () => {
  test('a new photo is not on the public listing; it waits in the queue under its business’s name', async () => {
    await asOwnerA(() => profile.addPhoto(ownImage('a1')));
    expect(vendors[0].images).toEqual(['https://old.example/a.jpg']);
    expect((await review.pending()).photos).toEqual([{ id: 'ph1', url: ownImage('a1'), businessName: 'Swayamvar Hall', uploadedAt: expect.any(String) }]);
  });

  test('approve → it joins that vendor’s public gallery, once, and leaves the queue', async () => {
    await asOwnerA(() => profile.addPhoto(ownImage('a1')));
    await review.reviewPhoto('ph1', true);
    await review.reviewPhoto('ph1', true); // a second click changes nothing
    expect(vendors[0].images).toEqual(['https://old.example/a.jpg', ownImage('a1')]);
    expect(vendors[1].images).toEqual([]);
    expect(photos[0]).toMatchObject({ status: 'APPROVED', reviewedAt: NOW });
    expect((await review.pending()).photos).toEqual([]);
  });

  test('reject → never public; the business keeps it for its own documents; a later "approve" does not undo the decision', async () => {
    await asOwnerA(() => profile.addPhoto(ownImage('a1')));
    await review.reviewPhoto('ph1', false);
    await review.reviewPhoto('ph1', true);
    expect(vendors[0].images).toEqual(['https://old.example/a.jpg']);
    expect((await asOwnerA(() => profile.get())).photos).toMatchObject([{ id: 'ph1', url: ownImage('a1'), status: 'REJECTED' }]);
  });

  test('the vendor removing an approved photo takes it off the public listing too', async () => {
    await asOwnerA(() => profile.addPhoto(ownImage('a1')));
    await review.reviewPhoto('ph1', true);
    await asOwnerA(() => profile.removePhoto('ph1'));
    expect(vendors[0].images).toEqual(['https://old.example/a.jpg']);
  });

  test('an uploaded video becomes the listing’s video only on approval; removing it clears the listing', async () => {
    await asOwnerA(() => profile.setVideo(ownVideo));
    expect(vendors[0].virtualTourVideo).toBe('');
    expect((await review.pending()).videos).toEqual([{ businessId: 'biz-a', url: ownVideo, isLink: false, businessName: 'Swayamvar Hall' }]);
    await review.reviewVideo('biz-a', true);
    expect(vendors[0].virtualTourVideo).toBe(ownVideo);
    expect((await review.pending()).videos).toEqual([]);
    await asOwnerA(() => profile.removeVideo());
    expect(vendors[0].virtualTourVideo).toBe('');
  });

  test('an approved LINK is only marked approved — the listing plays files, not links', async () => {
    await asOwnerA(() => profile.setVideo('https://youtu.be/abc123'));
    await review.reviewVideo('biz-a', true);
    expect(businesses[0].videoStatus).toBe('APPROVED');
    expect(vendors[0].virtualTourVideo).toBe('');
  });

  test('replacing a video sends the new one back to the queue', async () => {
    await asOwnerA(() => profile.setVideo(ownVideo));
    await review.reviewVideo('biz-a', true);
    await asOwnerA(() => profile.setVideo('https://youtu.be/new'));
    expect(businesses[0].videoStatus).toBe('PENDING');
    expect((await review.pending()).videos).toHaveLength(1);
  });

  test('a photo or video that does not exist is not found', async () => {
    await expect(review.reviewPhoto('nope', true)).rejects.toThrow();
    await expect(review.reviewVideo('biz-b', true)).rejects.toThrow();
  });
});
