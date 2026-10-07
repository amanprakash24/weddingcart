/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runInScope, type Scope } from '@/lib/ownership/scope';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// The business profile on a real database, through the real services and two real vendor logins: venue A completes its profile
// (name, GST number, logo, photos, video); nothing reaches its PUBLIC listing until Shaadi Shopping approves it; venue B cannot
// see or touch any of it. The storage itself (Cloudinary) is not called — addresses are checked against a test cloud name.
dbDescribe('the business profile and its review (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let profile: ReturnType<typeof import('@/services/venueProfile.service').createVenueProfileService>;
  let review: ReturnType<typeof import('@/services/venueProfile.service').createProfileReviewService>;
  let businessSvc: typeof import('@/services/venueBusiness.service').venueBusinessService;
  const users: string[] = [];
  const vendorIds: string[] = [];
  let scopeA: Extract<Scope, { kind: 'BUSINESS' }>;
  let scopeB: Extract<Scope, { kind: 'BUSINESS' }>;

  const CLOUD = 'dbtestcloud';
  const image = (name: string) => `https://res.cloudinary.com/${CLOUD}/image/upload/v1/shaadishopping/vendor-profile/${name}.jpg`;
  const video = () => `https://res.cloudinary.com/${CLOUD}/video/upload/v1/shaadishopping/vendor-profile/tour-${fx.runId}.mp4`;
  const outcome = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e);
  const inA = <T>(fn: () => Promise<T>) => runInScope(scopeA, fn);
  const inB = <T>(fn: () => Promise<T>) => runInScope(scopeB, fn);
  const listing = (i: number) => app.prisma.vendor.findUniqueOrThrow({ where: { id: vendorIds[i] }, select: { images: true, virtualTourVideo: true, name: true } });
  const view = async <T>(p: Promise<T>) => {
    const v = await p;
    if (!v || typeof v !== 'object' || !('photos' in v)) throw new Error(`expected a profile, got ${JSON.stringify(v)}`);
    return v as Extract<T, { photos: unknown }>;
  };

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    const svc = await import('@/services/venueProfile.service');
    const deps = { db: app.prisma, cloudName: () => CLOUD, now: () => new Date() };
    profile = svc.createVenueProfileService(deps);
    review = svc.createProfileReviewService(deps);
    businessSvc = (await import('@/services/venueBusiness.service')).venueBusinessService;
    const [{ id: anyVendorId }] = await fx.vendors(1);
    const { categoryId } = await app.prisma.vendor.findUniqueOrThrow({ where: { id: anyVendorId }, select: { categoryId: true } });
    for (const [i, label] of ['A', 'B'].entries()) {
      const v = await app.prisma.vendor.create({ data: { slug: `dbtest-profile-${label.toLowerCase()}-${fx.runId}`, name: `DBTEST Profile Venue ${label} ${fx.runId}`, categoryId, city: 'Patna', priceMin: 1, priceMax: 2, image: 'x', description: 'x' } });
      vendorIds.push(v.id);
      const u = await app.prisma.user.create({ data: { phone: `95000${fx.runId.replace(/\D/g, '').padEnd(4, '0').slice(0, 4)}${i}`, roles: { create: { role: 'VENDOR' } } } });
      users.push(u.id);
      await app.prisma.vendorProfile.create({ data: { userId: u.id, vendorId: v.id } });
    }
    scopeA = (await businessSvc.scopeForVendorLogin(users[0]))!;
    scopeB = (await businessSvc.scopeForVendorLogin(users[1]))!;
  });

  afterAll(async () => {
    if (!app) return;
    const ids = [scopeA?.businessId, scopeB?.businessId].filter(Boolean) as string[];
    await app.prisma.businessMember.deleteMany({ where: { userId: { in: users } } });
    await app.prisma.business.deleteMany({ where: { id: { in: ids } } }); // its photos go with it
    await app.prisma.vendorProfile.deleteMany({ where: { userId: { in: users } } });
    await app.prisma.user.deleteMany({ where: { id: { in: users } } });
    await app.prisma.vendor.deleteMany({ where: { id: { in: vendorIds } } });
    if (fx) await fx.purge();
  });

  test('a new business has its listing’s name and still needs a logo and photos', async () => {
    const p = await inA(() => profile.get());
    expect(p).toMatchObject({ logoUrl: null, gstin: null, video: null, photos: [], missing: ['logo', 'photos'], canEdit: true });
    expect(p.name).toContain('DBTEST Profile Venue A');
  });

  test('name and GST number are saved clean; a mistyped GST number is refused and nothing changes', async () => {
    expect(await view(inA(() => profile.update({ name: ` DBTEST   Hall ${fx.runId} `, gstin: '27aapfu0939f1zv' })))).toMatchObject({ name: `DBTEST Hall ${fx.runId}`, gstin: '27AAPFU0939F1ZV' });
    expect(await inA(() => profile.update({ name: 'Other', gstin: '27AAPFU0939F1ZW' }))).toEqual({ errors: { gstin: expect.any(String) } });
    expect(await app.prisma.business.findUniqueOrThrow({ where: { id: scopeA.businessId }, select: { name: true, gstin: true } })).toEqual({ name: `DBTEST Hall ${fx.runId}`, gstin: '27AAPFU0939F1ZV' });
    // The document name changed; the PUBLIC listing's name is Shaadi Shopping's to set and is untouched.
    expect((await listing(0)).name).toContain('DBTEST Profile Venue A');
  });

  test('logo and three photos complete the profile — and none of it is on the public listing yet', async () => {
    await inA(() => profile.setLogo(image(`logo-${fx.runId}`)));
    for (const n of ['p1', 'p2', 'p3']) await inA(() => profile.addPhoto(image(`${n}-${fx.runId}`)));
    const p = await inA(() => profile.get());
    expect(p.missing).toEqual([]);
    expect(p.photos.map((x) => x.status)).toEqual(['PENDING', 'PENDING', 'PENDING']);
    expect((await listing(0)).images).toEqual([]);
  });

  test('an address that is not our own upload is never saved', async () => {
    for (const bad of ['https://evil.example/x.jpg', `https://res.cloudinary.com/othercloud/image/upload/v1/shaadishopping/vendor-profile/x.jpg`]) {
      expect((await outcome(inA(() => profile.addPhoto(bad))))?.name).toBe('ValidationError');
      expect((await outcome(inA(() => profile.setLogo(bad))))?.name).toBe('ValidationError');
    }
    expect((await inA(() => profile.get())).photos).toHaveLength(3);
  });

  test('each venue has its own profile — B sees none of A’s photos and cannot remove one', async () => {
    const aPhotoId = (await inA(() => profile.get())).photos[0].id;
    expect((await inB(() => profile.get())).photos).toEqual([]);
    expect((await outcome(inB(() => profile.removePhoto(aPhotoId))))?.name).toBe('NotFoundError');
    expect((await inA(() => profile.get())).photos).toHaveLength(3);
  });

  test('Shaadi Shopping’s review: approve puts a photo on THAT vendor’s listing once; reject keeps it off; a decision is final', async () => {
    const [first, second] = (await inA(() => profile.get())).photos;
    const queued = (await review.pending()).photos.filter((p) => p.url.includes(fx.runId));
    expect(queued.map((p) => p.id).sort()).toEqual((await inA(() => profile.get())).photos.map((p) => p.id).sort());
    expect(queued[0].businessName).toBe(`DBTEST Hall ${fx.runId}`);

    await review.reviewPhoto(first.id, true);
    await review.reviewPhoto(first.id, true);
    await review.reviewPhoto(second.id, false);
    await review.reviewPhoto(second.id, true); // already rejected — stays rejected
    expect((await listing(0)).images).toEqual([first.url]);
    expect((await listing(1)).images).toEqual([]);
    expect((await inA(() => profile.get())).photos.map((p) => p.status)).toEqual(['APPROVED', 'REJECTED', 'PENDING']);
  });

  test('the vendor removing an approved photo takes it off the public listing', async () => {
    const approved = (await inA(() => profile.get())).photos.find((p) => p.status === 'APPROVED')!;
    await inA(() => profile.removePhoto(approved.id));
    expect((await listing(0)).images).toEqual([]);
    expect((await inA(() => profile.missing()))).toEqual(['photos']); // back under three
  });

  test('the video: waits for approval, becomes the listing’s video when approved, and leaves it when removed', async () => {
    expect(await inA(() => profile.setVideo('https://vimeo.com/1'))).toEqual({ errors: { videoLink: expect.any(String) } });
    expect(await view(inA(() => profile.setVideo(video())))).toMatchObject({ video: { isLink: false, status: 'PENDING' } });
    expect((await listing(0)).virtualTourVideo).toBe('');
    expect((await review.pending()).videos.some((v) => v.businessId === scopeA.businessId)).toBe(true);

    await review.reviewVideo(scopeA.businessId, true);
    expect((await listing(0)).virtualTourVideo).toBe(video());
    expect((await review.pending()).videos.some((v) => v.businessId === scopeA.businessId)).toBe(false);

    await inA(() => profile.removeVideo());
    expect((await listing(0)).virtualTourVideo).toBe('');
    expect((await outcome(review.reviewVideo(scopeB.businessId, true)))?.name).toBe('NotFoundError'); // B never had one
  });

  test('staff of the business can read the profile but not change it', async () => {
    const asStaff = <T>(fn: () => Promise<T>) => runInScope({ kind: 'BUSINESS', businessId: scopeA.businessId, role: 'STAFF' }, fn);
    expect((await asStaff(() => profile.get())).canEdit).toBe(false);
    expect(await asStaff(() => profile.update({ name: 'Hacked' }))).toEqual({ forbidden: true });
    expect(await asStaff(() => profile.addPhoto(image('staff')))).toEqual({ forbidden: true });
  });
});
