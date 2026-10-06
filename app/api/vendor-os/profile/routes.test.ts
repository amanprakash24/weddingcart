/// <reference types="bun-types" />
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { ValidationError } from '@/lib/errors';

// The vendor's profile routes and Shaadi Shopping's review routes. The services and the storage are faked (their own tests cover
// the rules); what is checked here is the order of things — nothing is stored before "may this login change the profile, and is
// there room?" — and who may call what.
type View = { name: string; canEdit: boolean; photos: { id: string; url?: string }[]; missing: string[]; logoUrl?: string | null; video?: { url: string } | null };
let view: View;
let admin = true;
const stored: string[] = [];

const get = mock(async () => view);
const setLogo = mock(async (url: string) => ({ ...view, logoUrl: url }));
const addPhoto = mock(async (url: string) => ({ ...view, photos: [...view.photos, { id: url }] }));
const removePhoto = mock(async (): Promise<unknown> => view);
const update = mock(async (): Promise<unknown> => view);
const setVideo = mock(async (): Promise<unknown> => view);
const removeVideo = mock(async (): Promise<unknown> => view);
const pending = mock(async () => ({ photos: [], videos: [] }));
const reviewPhoto = mock(async () => undefined);
const reviewVideo = mock(async () => undefined);
const storeProfileImage = mock(async (_file: unknown, kind: string) => {
  const url = `https://res.cloudinary.com/democloud/image/upload/v1/shaadishopping/vendor-profile/${kind}-${stored.length}.jpg`;
  stored.push(url);
  return url;
});
const checkProfileVideo = mock(async () => undefined);
const discardProfileUpload = mock(async () => undefined);

// The REAL upload limiter runs, against an in-memory login_attempts table (the same pattern as the other route tests) — the
// limiter module itself is never mocked, because a module mock would leak into every other test file.
const attempts: { identifier: string; success: boolean; createdAt: Date }[] = [];
mock.module('@/lib/prisma', () => ({
  prisma: {
    loginAttempt: {
      count: mock(async (a: { where: { identifier: string; createdAt: { gt: Date } } }) => attempts.filter((r) => r.identifier === a.where.identifier && r.createdAt > a.where.createdAt.gt).length),
      create: mock(async (a: { data: { identifier: string; success: boolean } }) => attempts.push({ ...a.data, createdAt: new Date() })),
      deleteMany: mock(async () => ({ count: 0 })),
    },
  },
}));
mock.module('@/lib/adminAuth', () => ({ requireAdmin: mock(async () => admin) }));
// The real wrappers resolve a business from the database; here they only pass the call through.
mock.module('@/lib/ownership/venueEntry', () => ({ venueScoped: <A extends unknown[], R>(fn: (...args: A) => Promise<R>) => fn }));
mock.module('@/lib/ownership/entry', () => ({ platformScoped: <A extends unknown[], R>(fn: (...args: A) => Promise<R>) => fn }));
mock.module('@/lib/venue/profileUpload', () => ({
  storeProfileImage,
  checkProfileVideo,
  discardProfileUpload,
  cloudinaryCloudName: () => 'democloud',
  profileVideoSignature: () => ({ timestamp: 1, folder: 'shaadishopping/vendor-profile', tags: 'vendor-profile,video', signature: 'sig', apiKey: 'key', cloudName: 'democloud', maxBytes: 1, maxSeconds: 1 }),
}));
mock.module('@/services/venueProfile.service', () => ({
  venueProfileService: { get, setLogo, addPhoto, removePhoto, update, setVideo, removeVideo },
  profileReviewService: { pending, reviewPhoto, reviewVideo },
}));

const profileRoute = await import('./route');
const { POST: logoRoute } = await import('./logo/route');
const { POST: photosRoute } = await import('./photos/route');
const { DELETE: removePhotoRoute } = await import('./photos/[id]/route');
const { POST: signatureRoute } = await import('./video-signature/route');
const videoRoute = await import('./video/route');
const { GET: pendingRoute } = await import('../../admin/profile-media/route');
const { POST: photoDecision } = await import('../../admin/profile-media/photos/[id]/route');
const { POST: videoDecision } = await import('../../admin/profile-media/videos/[businessId]/route');

const base = 'https://www.shaadishopping.com/api/vendor-os/profile';
const json = (path: string, method: string, body: unknown) => new NextRequest(`${base}${path}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const upload = (path: string) => {
  const form = new FormData();
  form.append('file', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'a.jpg', { type: 'image/jpeg' }));
  return new NextRequest(`${base}${path}`, { method: 'POST', body: form });
};

beforeEach(() => {
  view = { name: 'Swayamvar Hall', canEdit: true, photos: [], missing: ['logo', 'photos'] };
  admin = true;
  stored.length = 0;
  attempts.length = 0;
  for (const m of [discardProfileUpload, get, setLogo, addPhoto, removePhoto, update, setVideo, removeVideo, pending, reviewPhoto, reviewVideo, storeProfileImage, checkProfileVideo]) m.mockClear();
  update.mockImplementation(async () => view);
  setVideo.mockImplementation(async () => view);
});

describe('the typed fields', () => {
  test('GET answers the profile, never cached', async () => {
    const res = await profileRoute.GET();
    expect(res.status).toBe(200);
    expect((await res.json()).data.name).toBe('Swayamvar Hall');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  test('PUT passes only the name and GST number; a wrong value → 400 with a sentence per box; staff → 403', async () => {
    await profileRoute.PUT(json('', 'PUT', { name: 'New name', gstin: '27AAPFU0939F1ZV', logoUrl: 'https://evil.example/x.png', businessId: 'someone-else' }));
    expect(update).toHaveBeenCalledWith({ name: 'New name', gstin: '27AAPFU0939F1ZV' });

    update.mockImplementation(async () => ({ errors: { gstin: 'That is not a valid GST number' } }));
    const bad = await profileRoute.PUT(json('', 'PUT', { name: 'x', gstin: 'nope' }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).fieldErrors).toEqual({ gstin: 'That is not a valid GST number' });

    update.mockImplementation(async () => ({ forbidden: true }));
    expect((await profileRoute.PUT(json('', 'PUT', { name: 'x' }))).status).toBe(403);
  });
});

describe('uploads — nothing is stored before the checks', () => {
  test('a logo is stored, then saved on the profile', async () => {
    const res = await logoRoute(upload('/logo'));
    expect(res.status).toBe(200);
    expect(storeProfileImage).toHaveBeenCalledTimes(1);
    expect(setLogo).toHaveBeenCalledWith(stored[0]);
  });

  test('staff: 403, and nothing reaches storage', async () => {
    view.canEdit = false;
    expect((await logoRoute(upload('/logo'))).status).toBe(403);
    expect((await photosRoute(upload('/photos'))).status).toBe(403);
    expect((await signatureRoute()).status).toBe(403);
    expect(storeProfileImage).not.toHaveBeenCalled();
  });

  test('a 13th photo: 409, and nothing reaches storage', async () => {
    view.photos = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}` }));
    const res = await photosRoute(upload('/photos'));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('up to 12 photos');
    expect(storeProfileImage).not.toHaveBeenCalled();
    expect(addPhoto).not.toHaveBeenCalled();
  });

  test('a file the storage step refuses (not an image, too large) → 400 with its sentence, and nothing is saved', async () => {
    storeProfileImage.mockImplementationOnce(async () => { throw new ValidationError('The file is not a valid JPEG, PNG or WebP image'); });
    const res = await photosRoute(upload('/photos'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('The file is not a valid JPEG, PNG or WebP image');
    expect(addPhoto).not.toHaveBeenCalled();
  });

  test('uploads are finite: after 40 in 15 minutes the next one is paused, and nothing reaches storage', async () => {
    for (let i = 0; i < 40; i++) expect((await logoRoute(upload('/logo'))).status).toBe(200);
    storeProfileImage.mockClear();
    const res = await logoRoute(upload('/logo'));
    expect(res.status).toBe(429);
    expect(storeProfileImage).not.toHaveBeenCalled();
  });

  test('a request that declares more than 4 MB is refused before it is read', async () => {
    const big = new NextRequest(`${base}/photos`, { method: 'POST', headers: { 'content-length': String(5 * 1024 * 1024) }, body: 'x' });
    expect((await photosRoute(big)).status).toBe(413);
    expect(storeProfileImage).not.toHaveBeenCalled();
  });
});

describe('nothing is left in storage', () => {
  const own = (name: string) => `https://res.cloudinary.com/democloud/image/upload/v1/shaadishopping/vendor-profile/${name}.jpg`;
  const del = (id: string) => removePhotoRoute(new NextRequest(`${base}/photos/${id}`, { method: 'DELETE' }), { params: Promise.resolve({ id }) });

  test('removing a photo deletes its stored file — the address comes from the profile, never from the request', async () => {
    view.photos = [{ id: 'ph1', url: own('a1') }, { id: 'ph2', url: own('a2') }];
    expect((await del('ph1')).status).toBe(200);
    expect(removePhoto).toHaveBeenCalledWith('ph1');
    expect(discardProfileUpload).toHaveBeenCalledTimes(1);
    expect(discardProfileUpload).toHaveBeenCalledWith(own('a1'), 'image');
  });

  test('a removal that is refused deletes nothing', async () => {
    view.photos = [{ id: 'ph1', url: own('a1') }];
    removePhoto.mockImplementationOnce(async () => ({ forbidden: true }));
    expect((await del('ph1')).status).toBe(403);
    expect(discardProfileUpload).not.toHaveBeenCalled();
  });

  test('a new logo replaces the old one in storage too', async () => {
    view.logoUrl = own('old-logo');
    expect((await logoRoute(upload('/logo'))).status).toBe(200);
    expect(discardProfileUpload).toHaveBeenCalledWith(own('old-logo'), 'image');
  });

  test('removing the video deletes it', async () => {
    const tour = 'https://res.cloudinary.com/democloud/video/upload/v1/shaadishopping/vendor-profile/tour.mp4';
    view.video = { url: tour };
    expect((await videoRoute.DELETE()).status).toBe(200);
    expect(discardProfileUpload).toHaveBeenCalledWith(tour, 'video');
  });
});

describe('the video', () => {
  test('one of our own uploads is measured before it is saved; a link is not', async () => {
    const own = 'https://res.cloudinary.com/democloud/video/upload/v1/shaadishopping/vendor-profile/tour.mp4';
    await videoRoute.PUT(json('/video', 'PUT', { url: own }));
    expect(checkProfileVideo).toHaveBeenCalledWith(own);
    expect(setVideo).toHaveBeenCalledWith(own);

    checkProfileVideo.mockClear();
    await videoRoute.PUT(json('/video', 'PUT', { url: 'https://youtu.be/abc123' }));
    expect(checkProfileVideo).not.toHaveBeenCalled();
    expect(setVideo).toHaveBeenCalledWith('https://youtu.be/abc123');
  });

  test('an upload over the limit is refused with its sentence and never saved', async () => {
    checkProfileVideo.mockImplementationOnce(async () => { throw new ValidationError('Please upload a video of up to 60 seconds and 50 MB'); });
    const res = await videoRoute.PUT(json('/video', 'PUT', { url: 'https://res.cloudinary.com/democloud/video/upload/v1/shaadishopping/vendor-profile/long.mp4' }));
    expect(res.status).toBe(400);
    expect(setVideo).not.toHaveBeenCalled();
  });

  test('staff cannot set a video, and nothing is measured for them', async () => {
    view.canEdit = false;
    expect((await videoRoute.PUT(json('/video', 'PUT', { url: 'https://youtu.be/abc123' }))).status).toBe(403);
    expect(checkProfileVideo).not.toHaveBeenCalled();
    expect(setVideo).not.toHaveBeenCalled();
  });
});

describe('Shaadi Shopping’s review routes', () => {
  const photoCtx = { params: Promise.resolve({ id: 'ph1' }) };
  const videoCtx = { params: Promise.resolve({ businessId: 'biz-a' }) };
  const decide = (approve: unknown) => json('', 'POST', { approve });

  test('an admin sees the queue and decides; the answer is what is still waiting', async () => {
    expect((await pendingRoute()).status).toBe(200);
    expect((await photoDecision(decide(true), photoCtx)).status).toBe(200);
    expect(reviewPhoto).toHaveBeenCalledWith('ph1', true);
    expect((await videoDecision(decide(false), videoCtx)).status).toBe(200);
    expect(reviewVideo).toHaveBeenCalledWith('biz-a', false);
  });

  test('a decision must say approve or reject', async () => {
    expect((await photoDecision(decide('yes'), photoCtx)).status).toBe(400);
    expect((await videoDecision(json('', 'POST', {}), videoCtx)).status).toBe(400);
    expect(reviewPhoto).not.toHaveBeenCalled();
    expect(reviewVideo).not.toHaveBeenCalled();
  });

  test('anyone who is not an admin → 401, and nothing is read or decided', async () => {
    admin = false;
    expect((await pendingRoute()).status).toBe(401);
    expect((await photoDecision(decide(true), photoCtx)).status).toBe(401);
    expect((await videoDecision(decide(true), videoCtx)).status).toBe(401);
    expect(pending).not.toHaveBeenCalled();
    expect(reviewPhoto).not.toHaveBeenCalled();
  });
});
