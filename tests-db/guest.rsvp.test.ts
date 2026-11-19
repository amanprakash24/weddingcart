/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runAsSystem, runInScope, PLATFORM_SCOPE, type Scope } from '@/lib/ownership/scope';
import { guestInputSchema } from '@/lib/guest/guestInput';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';

// The two guest bugs found in the Client OS audit (19 Nov 2026), on a real database through the real services:
//  1. A guest's RSVP link on a wedding a VENUE runs on Vivah OS opened "Page Not Found": the link always read as Shaadi Shopping.
//     It now reads as the wedding's own business (lib/guest/rsvpEntry.ts).
//  2. Editing a guest (e.g. changing their RSVP status) was refused when the guest had no phone / email / category / notes saved,
//     because the editor sends those back as null. The shared rules (lib/guest/guestInput.ts) now accept null.
//  3. (Found by this test.) Adding or editing a guest on a venue's wedding failed: the guest service handed back its queries un-run,
//     so they could start outside the business scope. services/guest.service.ts now awaits each one.
dbDescribe('guest RSVP links and guest edits (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let guests: typeof import('@/services/guest.service').guestService;
  let scopeForRsvpToken: typeof import('@/lib/guest/rsvpEntry').scopeForRsvpToken;
  let businessSvc: typeof import('@/services/venueBusiness.service').venueBusinessService;
  let scope: Extract<Scope, { kind: 'BUSINESS' }>;
  let user = '';
  let vendorId = '';
  let weddingId = '';
  let eventId = '';

  const inV = <T>(fn: () => Promise<T>) => runInScope(scope, fn);

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    guests = (await import('@/services/guest.service')).guestService;
    scopeForRsvpToken = (await import('@/lib/guest/rsvpEntry')).scopeForRsvpToken;
    businessSvc = (await import('@/services/venueBusiness.service')).venueBusinessService;

    // A venue on Vivah OS, with its own business.
    const [{ id: anyVendorId }] = await fx.vendors(1);
    const { categoryId } = await app.prisma.vendor.findUniqueOrThrow({ where: { id: anyVendorId }, select: { categoryId: true } });
    const v = await app.prisma.vendor.create({ data: { slug: `dbtest-rsvp-${fx.runId}`, name: `DBTEST RSVP Venue ${fx.runId}`, categoryId, city: 'Patna', priceMin: 1, priceMax: 2, image: 'x', description: 'x' } });
    vendorId = v.id;
    const u = await app.prisma.user.create({ data: { phone: `94100${fx.runId.replace(/\D/g, '').padEnd(5, '0').slice(0, 5)}`, roles: { create: { role: 'VENDOR' } } } });
    user = u.id;
    await app.prisma.vendorProfile.create({ data: { userId: u.id, vendorId: v.id } });
    scope = (await businessSvc.scopeForVendorLogin(user))!;

    // The venue's own wedding, with one function.
    const wedding = await inV(() => app.prisma.wedding.create({
      data: {
        weddingNumber: `DBTEST-RSVP-${fx.runId}`, source: 'CRM', primaryDate: new Date('2027-02-14T12:00:00Z'), city: 'Patna',
        events: { create: { type: 'WEDDING', date: new Date('2027-02-14T12:00:00Z'), city: 'Patna' } },
      },
      include: { events: true },
    }));
    weddingId = wedding.id;
    eventId = wedding.events[0].id;
  });

  afterAll(async () => {
    if (!app) return;
    const id = scope?.businessId;
    if (id) {
      await runAsSystem('test clean-up', async () => {
        await app.prisma.wedding.deleteMany({ where: { businessId: id } }); // its events and guests cascade
        await app.prisma.businessClient.deleteMany({ where: { businessId: id } });
      });
      await app.prisma.businessMember.deleteMany({ where: { userId: user } });
      await app.prisma.business.deleteMany({ where: { id } });
    }
    await app.prisma.vendorProfile.deleteMany({ where: { userId: user } });
    await app.prisma.user.deleteMany({ where: { id: user } });
    if (vendorId) await app.prisma.vendor.deleteMany({ where: { id: vendorId } });
    if (fx) await fx.purge();
  });

  test('1. a guest of a venue’s wedding can open and answer their RSVP link', async () => {
    const guest = await inV(() => guests.create(weddingId, { name: 'DBTEST Guest Venue', accompanyingGuests: 1 }));
    const token = guest.rsvpToken;

    // The bug: read as Shaadi Shopping, the guest is invisible.
    expect(await runInScope(PLATFORM_SCOPE, () => guests.getPublicByToken(token))).toBeNull();

    // The fix: the link runs as the wedding's own business.
    const linkScope = await scopeForRsvpToken(token);
    expect(linkScope).toEqual(scope.kind === 'BUSINESS' ? { kind: 'BUSINESS', businessId: scope.businessId, role: 'STAFF' } : scope);
    const seen = await runInScope(linkScope, () => guests.getPublicByToken(token));
    expect(seen?.name).toBe('DBTEST Guest Venue');
    expect(seen?.wedding.events.map((e) => e.id)).toEqual([eventId]);

    await runInScope(linkScope, () => guests.submitPublic(token, { rsvpStatus: 'ATTENDING', accompanyingGuests: 2, functionResponses: [{ weddingEventId: eventId, status: 'ATTENDING' }] }));
    const after = await inV(() => app.prisma.guest.findUniqueOrThrow({ where: { id: guest.id }, include: { functionResponses: true } }));
    expect(after.rsvpStatus).toBe('ATTENDING');
    expect(after.accompanyingGuests).toBe(2);
    expect(after.functionResponses.map((r) => r.status)).toEqual(['ATTENDING']);
  });

  test('2. an unknown or malformed link stays "not found" (runs as Shaadi Shopping, finds nothing)', async () => {
    expect(await scopeForRsvpToken('not-a-token')).toEqual(PLATFORM_SCOPE);
    const unknown = '00000000-0000-4000-8000-000000000000';
    expect(await scopeForRsvpToken(unknown)).toEqual(PLATFORM_SCOPE);
    expect(await runInScope(PLATFORM_SCOPE, () => guests.getPublicByToken(unknown))).toBeNull();
  });

  test('3. a guest saved with only a name can be edited: the editor’s own request is accepted and saved', async () => {
    const guest = await inV(() => guests.create(weddingId, { name: 'DBTEST Name Only' }));
    const loaded = (await inV(() => guests.listForAdmin(weddingId))).find((g) => g.id === guest.id)!;
    expect(loaded.phone).toBeNull();
    expect(loaded.notes).toBeNull();

    // Exactly what components/wedding/workspace/GuestRsvp.tsx sends to change the RSVP status.
    const request = { ...loaded, rsvpStatus: 'ATTENDING', functionResponses: loaded.functionResponses.map((r) => ({ weddingEventId: r.weddingEvent.id, status: r.status })) };
    const parsed = guestInputSchema.safeParse(JSON.parse(JSON.stringify(request)));
    expect(parsed.success).toBe(true);

    const saved = await inV(() => guests.update(weddingId, guest.id, parsed.data!));
    expect(saved.rsvpStatus).toBe('ATTENDING');
    expect(saved.name).toBe('DBTEST Name Only');
    expect(saved.phone).toBeNull();
  });

  // Guest management (Client OS phase 1, 19 Nov 2026).
  test('4. invited to the reception only: the link shows only the reception, and only that answer is saved', async () => {
    const reception = await inV(() => app.prisma.weddingEvent.create({ data: { weddingId, type: 'RECEPTION', date: new Date('2027-02-15T12:00:00Z'), city: 'Patna' } }));
    const guest = await inV(() => guests.create(weddingId, { name: 'DBTEST Reception Only', functionResponses: [{ weddingEventId: reception.id, status: 'PENDING' }] }));
    const linkScope = await scopeForRsvpToken(guest.rsvpToken);

    const seen = await runInScope(linkScope, () => guests.getPublicByToken(guest.rsvpToken));
    expect(seen?.wedding.events.map((e) => e.id)).toEqual([reception.id]);

    // A crafted answer for the wedding too is ignored; the reception answer is saved; the invitation stays.
    await runInScope(linkScope, () => guests.submitPublic(guest.rsvpToken, { rsvpStatus: 'ATTENDING', accompanyingGuests: 0, functionResponses: [{ weddingEventId: eventId, status: 'ATTENDING' }, { weddingEventId: reception.id, status: 'ATTENDING' }] }));
    const rows = await inV(() => app.prisma.guestFunctionResponse.findMany({ where: { guestId: guest.id } }));
    expect(rows.map((r) => [r.weddingEventId, r.status])).toEqual([[reception.id, 'ATTENDING']]);

    // A guest with no invitation rows still sees every function (as before).
    const everyone = await inV(() => guests.create(weddingId, { name: 'DBTEST Everything' }));
    const all = await runInScope(linkScope, () => guests.getPublicByToken(everyone.rsvpToken));
    expect(all?.wedding.events.map((e) => e.id).sort()).toEqual([eventId, reception.id].sort());
  });

  test('5. "comes with": both guests point at each other; re-pairing and removing keep it consistent', async () => {
    const a = await inV(() => guests.create(weddingId, { name: 'DBTEST Pair A', side: 'BRIDE', familyGroup: 'Sharma family', relation: 'Mama', isVip: true }));
    const b = await inV(() => guests.create(weddingId, { name: 'DBTEST Pair B', pairedGuestId: a.id }));
    const c = await inV(() => guests.create(weddingId, { name: 'DBTEST Pair C' }));
    const read = (id: string) => inV(() => app.prisma.guest.findUniqueOrThrow({ where: { id } }));

    expect((await read(a.id)).pairedGuestId).toBe(b.id);
    expect((await read(b.id)).pairedGuestId).toBe(a.id);
    const saved = await read(a.id);
    expect([saved.side, saved.familyGroup, saved.relation, saved.isVip]).toEqual(['BRIDE', 'Sharma family', 'Mama', true]);

    // A now comes with C: B is released.
    await inV(() => guests.update(weddingId, a.id, { name: 'DBTEST Pair A', pairedGuestId: c.id }));
    expect((await read(a.id)).pairedGuestId).toBe(c.id);
    expect((await read(c.id)).pairedGuestId).toBe(a.id);
    expect((await read(b.id)).pairedGuestId).toBeNull();

    // An editor that does not send the pairing leaves it alone.
    await inV(() => guests.update(weddingId, a.id, { name: 'DBTEST Pair A renamed' }));
    expect((await read(a.id)).pairedGuestId).toBe(c.id);

    // Removing C clears A's link.
    await inV(() => guests.remove(weddingId, c.id));
    expect((await read(a.id)).pairedGuestId).toBeNull();

    // A guest cannot come with themselves, or with a guest of another wedding.
    const self = await inV(() => guests.update(weddingId, a.id, { name: 'x', pairedGuestId: a.id })).then(() => null, (e: Error) => e);
    expect(self?.name).toBe('ValidationError');
    const other = await inV(() => guests.update(weddingId, a.id, { name: 'x', pairedGuestId: '00000000-0000-4000-8000-000000000000' })).then(() => null, (e: Error) => e);
    expect(other?.name).toBe('ValidationError');
  });
});
