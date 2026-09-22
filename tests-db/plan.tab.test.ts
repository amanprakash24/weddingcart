/// <reference types="bun-types" />
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dbDescribe, loadApp, type App } from './helpers/app';
import { createFixtures, type Fixtures } from './helpers/fixtures';
import { buildControlRoom } from '@/lib/wedding/controlRoom';
import type { WeddingWorkspace } from '@/components/wedding/workspace/types';

// The Plan tab's actions, through the real services against staging: coordinator, tasks with dates / owners / functions, and the vendor
// rows whose "Confirm booking…" / "Assign a vendor…" tasks close themselves. Nothing here talks to the outside world.
dbDescribe('Plan tab actions (real database)', () => {
  let app: App;
  let fx: Fixtures;
  let weddingId = '';
  let staffId = '';
  let venueVendorId = '';
  let extraVendorId = '';

  const errorOf = async (p: Promise<unknown>) => (await p.then(() => null, (e: Error) => e)) as Error | null;
  // exactly what the browser receives: dates become strings
  const view = async () => buildControlRoom(JSON.parse(JSON.stringify(await app.weddingWorkspaceService.getWorkspace(weddingId))) as WeddingWorkspace);
  const tasksOf = () => app.prisma.task.findMany({ where: { weddingId }, orderBy: { createdAt: 'asc' } });

  beforeAll(async () => {
    app = await loadApp();
    fx = createFixtures(app);
    await fx.purge();
    const [venue, extra] = await fx.vendors(2);
    venueVendorId = venue.id;
    extraVendorId = extra.id;
    const staff = await app.prisma.user.findFirst({ where: { roles: { some: { role: { in: ['SUPER_ADMIN', 'SALES', 'OPERATIONS'] } } } }, select: { id: true } });
    if (!staff) throw new Error('the staging database needs at least one staff user');
    staffId = staff.id;
    const consultation = await fx.consultation({ name: 'DBTEST Plan Tab', weddingDate: '2027-01-15', guestCount: 200 });
    const { booking } = await fx.confirmedBooking(consultation.id, {
      advance: 20000,
      items: [fx.line('Banquet hall hire', 60000, 1, venueVendorId, 'Venue'), fx.line('Photography', 12500, 1, undefined, 'Photography')],
    });
    weddingId = (await app.convertBookingToWedding(booking.id)).id;
  });
  afterAll(async () => {
    if (fx) await fx.purge();
  });

  test('a wedding made from a booking starts with no coordinator, a pending venue and an unassigned photography service — shown as vendors, not tasks', async () => {
    const v = await view();
    expect(v.secondary.coordinator).toBeNull();
    expect(v.vendors.map((r) => `${r.category}:${r.state}`)).toEqual(['Venues:pending', 'Photography:unassigned']);
    expect(v.vendors[1]).toMatchObject({ quotedPrice: 12500 });
    expect(v.vendors[1].weddingEventId).toBeTruthy();
    expect(v.tasks.total).toBe(0); // the two follow-up tasks are not counted as tasks
    expect(v.next.title).toContain('to confirm'); // pending vendor first…
    expect(v.attention.map((a) => a.kind)).toEqual(expect.arrayContaining(['PENDING_VENDOR_CONFIRMATION', 'ASSIGN_VENDOR']));
    expect(v.next.target).toBe('plan');
  });

  test('assigning a coordinator: only team members, recorded on the wedding, removable', async () => {
    expect((await errorOf(app.weddingWorkspaceService.assignCoordinator(weddingId, '00000000-0000-0000-0000-000000000000', null)))?.name).toBe('NotFoundError');
    await app.weddingWorkspaceService.assignCoordinator(weddingId, staffId, staffId);
    const v = await view();
    expect(v.secondary.coordinator).not.toBeNull();
    const log = await app.prisma.activityLog.findFirst({ where: { weddingId, summary: { startsWith: 'Coordinator assigned' } } });
    expect(log).not.toBeNull();
    await app.weddingWorkspaceService.assignCoordinator(weddingId, null, staffId);
    expect((await view()).secondary.coordinator).toBeNull();
    await app.weddingWorkspaceService.assignCoordinator(weddingId, staffId, staffId); // leave one assigned
    expect((await view()).attention.some((a) => a.kind === 'MISSING_COORDINATOR')).toBe(false);
  });

  test('a task with a due date, priority, owner and function — overdue shows up in the Overview; reopen, edit and cancel work', async () => {
    const eventId = (await app.prisma.weddingEvent.findFirstOrThrow({ where: { weddingId } })).id;
    const yesterday = new Date(Date.now() - 2 * 86_400_000);
    yesterday.setUTCHours(0, 0, 0, 0);
    const created = await app.weddingWorkspaceService.addTask(weddingId, { title: 'Book the band', dueAt: yesterday, priority: 'HIGH', assignedToId: staffId, weddingEventId: eventId, createdById: staffId });
    expect(created).toMatchObject({ title: 'Book the band', priority: 'HIGH', assignedToId: staffId, weddingEventId: eventId });

    let v = await view();
    expect(v.tasks).toMatchObject({ open: 1, overdue: 1 });
    expect(v.attention.map((a) => a.kind)).toContain('CRITICAL_OVERDUE');

    const moved = new Date(Date.now() + 5 * 86_400_000);
    moved.setUTCHours(0, 0, 0, 0);
    await app.weddingWorkspaceService.updateTask(weddingId, created.id, { dueAt: moved, priority: 'LOW', assignedToId: null });
    v = await view();
    expect(v.tasks).toMatchObject({ open: 1, overdue: 0 });
    expect(v.attention.map((a) => a.kind)).not.toContain('CRITICAL_OVERDUE');

    await app.weddingWorkspaceService.updateTask(weddingId, created.id, { status: 'DONE' });
    expect((await app.prisma.task.findUniqueOrThrow({ where: { id: created.id } })).completedAt).not.toBeNull();
    await app.weddingWorkspaceService.updateTask(weddingId, created.id, { status: 'PENDING' });
    expect(await app.prisma.task.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ status: 'PENDING', completedAt: null });
    await app.weddingWorkspaceService.updateTask(weddingId, created.id, { status: 'CANCELLED' });
    expect((await view()).tasks.open).toBe(0);
    expect((await errorOf(app.weddingWorkspaceService.updateTask(weddingId, created.id, { title: '  ' })))?.message).toContain('needs a title');
  });

  test('confirming the venue finishes its "Confirm booking…" task, and the wedding still reads Planning', async () => {
    const v0 = await view();
    const venueRow = v0.vendors.find((r) => r.state === 'pending')!;
    const before = (await tasksOf()).find((t) => t.vendorBookingId === venueRow.vendorBookingId)!;
    expect(before.status).toBe('PENDING');

    await app.weddingWorkspaceService.updateVendorBookingStatus(weddingId, venueRow.vendorBookingId as string, 'CONFIRMED');

    const after = await app.prisma.task.findUniqueOrThrow({ where: { id: before.id } });
    expect(after).toMatchObject({ status: 'DONE' });
    expect(after.completedAt).not.toBeNull();
    const v = await view();
    expect(v.vendors.find((r) => r.category === 'Venues')?.state).toBe('confirmed');
    expect(v.stageLabel).toBe('Planning'); // vendor confirmation does not decide the stage
  });

  test('assigning a vendor to the photography service books them and closes the "Assign a vendor…" task; the new booking then needs a yes', async () => {
    const row = (await view()).vendors.find((r) => r.state === 'unassigned')!;
    const wrong = await errorOf(app.weddingWorkspaceService.addVendorBooking(weddingId, { weddingEventId: row.weddingEventId as string, vendorId: extraVendorId, agreedPrice: 12500, resolvesTaskId: '00000000-0000-0000-0000-000000000000' }, staffId));
    expect(wrong?.name).toBe('NotFoundError'); // nothing was booked
    const bookingsBefore = await app.prisma.vendorBooking.count({ where: { weddingEvent: { weddingId } } });

    const booking = await app.weddingWorkspaceService.addVendorBooking(weddingId, { weddingEventId: row.weddingEventId as string, vendorId: extraVendorId, agreedPrice: row.quotedPrice as number, resolvesTaskId: row.taskId as string }, staffId);
    expect(booking).toMatchObject({ vendorId: extraVendorId, agreedPrice: 12500, status: 'PENDING_VENDOR_CONFIRMATION' });
    expect(await app.prisma.vendorBooking.count({ where: { weddingEvent: { weddingId } } })).toBe(bookingsBefore + 1);
    expect(await app.prisma.task.findUniqueOrThrow({ where: { id: row.taskId as string } })).toMatchObject({ status: 'DONE' });

    const v = await view();
    expect(v.vendors.some((r) => r.state === 'unassigned')).toBe(false);
    expect(v.vendors.filter((r) => r.state === 'pending')).toHaveLength(1);
    expect(v.attention.map((a) => a.kind)).not.toContain('ASSIGN_VENDOR');
  });

  test('a vendor who declines cancels their confirm task; the wedding keeps its stage', async () => {
    const pending = (await view()).vendors.find((r) => r.state === 'pending')!;
    const task = (await tasksOf()).find((t) => t.vendorBookingId === pending.vendorBookingId)!;
    await app.weddingWorkspaceService.updateVendorBookingStatus(weddingId, pending.vendorBookingId as string, 'DECLINED', 'fully booked');
    expect(await app.prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ status: 'CANCELLED' });
    const v = await view();
    expect(v.vendors.find((r) => r.vendorBookingId === pending.vendorBookingId)?.state).toBe('declined');
    expect(v.stageLabel).toBe('Planning');
  });
});
