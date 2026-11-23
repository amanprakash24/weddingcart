import type { Prisma } from '@/generated/prisma/client';
import { ActivityType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { PLATFORM_BUSINESS_ID } from '@/lib/ownership/owned';
import { askAgainOutcome, normaliseMobile, ownVendorProblem, staffMoveProblem, type OwnVendorInput, type QuoteStatus } from '@/lib/wedding/coupleVendors';

// Couple vendors and "Ask for a quote" (22 Nov 2026, Client OS → Vendors). Rules: lib/wedding/coupleVendors.ts.
//
// The couple's calls run inside asCoupleWedding (their own wedding, in its business). Staff calls run in Shaadi Shopping's scope.
// Outside vendors are only ever CoupleVendor rows — never a VendorBooking, a payout or a commission. A quote request only names a vendor
// listed on Shaadi Shopping; Shaadi Shopping answers it and, if it goes ahead, books the vendor the normal way (VendorBooking).

type Tx = Prisma.TransactionClient;
const QUOTE_TASK = (vendor: string) => `Couple asked for a quote: ${vendor}`;

async function openWedding(tx: Tx | typeof prisma, weddingId: string) {
  const w = await tx.wedding.findUnique({ where: { id: weddingId }, select: { id: true, status: true, businessId: true, city: true, coordinatorId: true } });
  if (!w) throw new NotFoundError('Wedding', weddingId);
  if (w.status === 'COMPLETED' || w.status === 'CANCELLED') throw new ValidationError(`This wedding is ${w.status.toLowerCase()} — it can no longer be changed`);
  return w;
}

async function checkFunction(tx: Tx, weddingId: string, eventId: string | null | undefined) {
  if (!eventId) return null;
  const e = await tx.weddingEvent.findFirst({ where: { id: eventId, weddingId }, select: { id: true } });
  if (!e) throw new ValidationError('Choose one of your functions');
  return e.id;
}

// The functions an enquiry is for: each once, each one of this wedding's.
async function checkFunctions(tx: Tx, weddingId: string, ids: readonly string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const found = await tx.weddingEvent.findMany({ where: { id: { in: unique }, weddingId }, select: { id: true } });
  if (found.length !== unique.length) throw new ValidationError('Choose one of your functions');
  return unique;
}

async function setFunctions(tx: Tx, requestId: string, ids: readonly string[]) {
  await tx.vendorQuoteFunction.deleteMany({ where: { requestId } });
  if (ids.length) await tx.vendorQuoteFunction.createMany({ data: ids.map((weddingEventId) => ({ requestId, weddingEventId })) });
}

function ownFields(input: OwnVendorInput) {
  const problem = ownVendorProblem(input);
  if (problem) throw new ValidationError(problem);
  return {
    name: input.name.trim(),
    category: input.category.trim(),
    phone: normaliseMobile(input.phone) ?? null,
    price: input.price ?? null,
    notes: input.notes?.trim() || null,
  };
}

async function log(tx: Tx, weddingId: string, summary: string, actorId: string | null) {
  await tx.activityLog.create({ data: { type: ActivityType.NOTE, summary, weddingId, performedById: actorId } });
}

export const coupleVendorsService = {
  // ---------- the couple's own (outside) vendors ----------

  async addOwn(weddingId: string, input: OwnVendorInput, coupleUserId: string) {
    const fields = ownFields(input);
    return prisma.$transaction(async (tx) => {
      await openWedding(tx, weddingId);
      const weddingEventId = await checkFunction(tx, weddingId, input.weddingEventId);
      const row = await tx.coupleVendor.create({ data: { ...fields, weddingId, weddingEventId, createdById: coupleUserId } });
      await log(tx, weddingId, `The couple added their own vendor: ${row.name} (${row.category}) — not a Shaadi Shopping partner`, coupleUserId);
      return row;
    });
  },

  async updateOwn(weddingId: string, id: string, input: OwnVendorInput, coupleUserId: string) {
    const fields = ownFields(input);
    return prisma.$transaction(async (tx) => {
      await openWedding(tx, weddingId);
      const existing = await tx.coupleVendor.findFirst({ where: { id, weddingId }, select: { id: true } });
      if (!existing) throw new NotFoundError('CoupleVendor', id);
      const weddingEventId = await checkFunction(tx, weddingId, input.weddingEventId);
      const row = await tx.coupleVendor.update({ where: { id }, data: { ...fields, weddingEventId } });
      await log(tx, weddingId, `The couple changed their own vendor: ${row.name} (${row.category})`, coupleUserId);
      return row;
    });
  },

  async removeOwn(weddingId: string, id: string, coupleUserId: string) {
    return prisma.$transaction(async (tx) => {
      await openWedding(tx, weddingId);
      const existing = await tx.coupleVendor.findFirst({ where: { id, weddingId }, select: { id: true, name: true } });
      if (!existing) throw new NotFoundError('CoupleVendor', id);
      await tx.coupleVendor.delete({ where: { id } });
      await log(tx, weddingId, `The couple removed their own vendor: ${existing.name}`, coupleUserId);
      return { removed: true as const };
    });
  },

  // ---------- finding vendors listed on Shaadi Shopping ----------

  // Published vendors of one category, the wedding's city first. Listing facts only (name, price range, rating, link) — never the
  // owner's contact details: the couple asks for a quote through Shaadi Shopping.
  async searchListed(weddingId: string, categorySlug: string) {
    const w = await prisma.wedding.findUnique({ where: { id: weddingId }, select: { city: true } });
    if (!w) throw new NotFoundError('Wedding', weddingId);
    const select = { id: true, slug: true, name: true, city: true, area: true, priceMin: true, priceMax: true, priceUnit: true, rating: true, reviewCount: true, image: true, category: { select: { name: true, slug: true } } } as const;
    const base = { status: 'PUBLISHED' as const, category: { slug: categorySlug } };
    const order = [{ isFeatured: 'desc' as const }, { sortOrder: 'asc' as const }, { rating: 'desc' as const }];
    const inCity = await prisma.vendor.findMany({ where: { ...base, city: { equals: w.city, mode: 'insensitive' } }, select, orderBy: order, take: 24 });
    if (inCity.length > 0) return { city: w.city, inCity: true, vendors: inCity };
    return { city: w.city, inCity: false, vendors: await prisma.vendor.findMany({ where: base, select, orderBy: order, take: 12 }) };
  },

  async categories() {
    return prisma.category.findMany({ where: { vendors: { some: { status: 'PUBLISHED' } } }, select: { slug: true, name: true }, orderBy: { name: 'asc' } });
  },

  // ---------- "Ask for a quote" ----------

  // Shaadi Shopping's weddings only (a venue's couple is pointed to Shaadi Shopping instead). Idempotent: asking twice — or two taps at
  // once — leaves one request; a closed or "not available" one starts again. Opens a task for the coordinator.
  async requestQuote(weddingId: string, input: { vendorId: string; weddingEventId?: string | null; weddingEventIds?: string[]; note?: string | null }, coupleUserId: string) {
    const note = input.note?.trim() || null;
    if (note && note.length > 500) throw new ValidationError('Keep the note under 500 characters');
    const run = () =>
      prisma.$transaction(async (tx) => {
        const w = await openWedding(tx, weddingId);
        if (w.businessId !== PLATFORM_BUSINESS_ID) throw new ValidationError('Ask Shaadi Shopping on WhatsApp for vendors for your wedding');
        const vendor = await tx.vendor.findFirst({ where: { id: input.vendorId, status: 'PUBLISHED' }, select: { id: true, name: true, category: { select: { name: true } } } });
        if (!vendor) throw new ValidationError('That vendor is not listed any more');
        const functionIds = await checkFunctions(tx, weddingId, input.weddingEventIds ?? (input.weddingEventId ? [input.weddingEventId] : []));
        const weddingEventId = functionIds[0] ?? null;
        const existing = await tx.vendorQuoteRequest.findUnique({ where: { weddingId_vendorId: { weddingId, vendorId: vendor.id } } });
        const outcome = askAgainOutcome((existing?.status as QuoteStatus | undefined) ?? null);
        if (outcome === 'KEEP') return existing!;
        const request =
          outcome === 'CREATE'
            ? await tx.vendorQuoteRequest.create({ data: { weddingId, vendorId: vendor.id, weddingEventId, note, requestedById: coupleUserId } })
            : await tx.vendorQuoteRequest.update({ where: { id: existing!.id }, data: { status: 'REQUESTED', weddingEventId, note, staffNote: null, handledById: null, handledAt: null, requestedById: coupleUserId } });
        await setFunctions(tx, request.id, functionIds);
        await tx.task.create({
          data: {
            context: 'WEDDING_TASK',
            title: QUOTE_TASK(vendor.name),
            description: `${vendor.category.name}${note ? ` — the couple wrote: “${note}”` : ''}. Check the vendor's price and dates and answer on the wedding page.`,
            priority: 'HIGH',
            weddingId,
            weddingEventId,
            assignedToId: w.coordinatorId,
          },
        });
        await log(tx, weddingId, `The couple asked for a quote from ${vendor.name} (${vendor.category.name})`, coupleUserId);
        return request;
      });
    try {
      return await run();
    } catch (e) {
      // two taps at once: the unique (wedding, vendor) lets one in; the other sees it
      if ((e as { code?: string })?.code === 'P2002') {
        const found = await prisma.vendorQuoteRequest.findUnique({ where: { weddingId_vendorId: { weddingId, vendorId: input.vendorId } } });
        if (found) return found;
      }
      throw e;
    }
  },

  // The couple changes which functions a live enquiry is for. A booked or closed one stays as it is.
  async setRequestFunctions(weddingId: string, requestId: string, ids: string[], coupleUserId: string) {
    return prisma.$transaction(async (tx) => {
      await openWedding(tx, weddingId);
      await tx.$queryRaw`SELECT "id" FROM "vendor_quote_requests" WHERE "id" = ${requestId} FOR UPDATE`;
      const r = await tx.vendorQuoteRequest.findFirst({ where: { id: requestId, weddingId }, include: { vendor: { select: { name: true } } } });
      if (!r) throw new NotFoundError('VendorQuoteRequest', requestId);
      if (r.status !== 'REQUESTED' && r.status !== 'QUOTED') throw new ValidationError('Only an open enquiry can be changed — ask your expert');
      const functionIds = await checkFunctions(tx, weddingId, ids);
      await setFunctions(tx, requestId, functionIds);
      const updated = await tx.vendorQuoteRequest.update({ where: { id: requestId }, data: { weddingEventId: functionIds[0] ?? null } });
      await log(tx, weddingId, `The couple changed which functions their enquiry to ${r.vendor.name} is for`, coupleUserId);
      return updated;
    });
  },

  async closeRequest(weddingId: string, requestId: string, coupleUserId: string) {
    return prisma.$transaction(async (tx) => {
      await openWedding(tx, weddingId);
      const r = await tx.vendorQuoteRequest.findFirst({ where: { id: requestId, weddingId }, include: { vendor: { select: { name: true } } } });
      if (!r) throw new NotFoundError('VendorQuoteRequest', requestId);
      if (r.status === 'CLOSED') return r;
      if (r.status === 'BOOKED') throw new ValidationError('This vendor is booked — ask your expert to change it');
      const closed = await tx.vendorQuoteRequest.update({ where: { id: requestId }, data: { status: 'CLOSED' } });
      // nothing left for the coordinator to do
      await tx.task.updateMany({ where: { weddingId, title: QUOTE_TASK(r.vendor.name), status: { in: ['PENDING', 'IN_PROGRESS'] } }, data: { status: 'CANCELLED' } });
      await log(tx, weddingId, `The couple closed their quote request for ${r.vendor.name}`, coupleUserId);
      return closed;
    });
  },

  // ---------- staff ----------

  // Shaadi Shopping answers a request. seenUpdatedAt guards against answering something the couple changed in the meantime.
  async answer(weddingId: string, requestId: string, input: { status: QuoteStatus; staffNote?: string | null; seenUpdatedAt: string }, actorId: string | null) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "vendor_quote_requests" WHERE "id" = ${requestId} FOR UPDATE`;
      const r = await tx.vendorQuoteRequest.findFirst({ where: { id: requestId, weddingId }, include: { vendor: { select: { name: true } } } });
      if (!r) throw new NotFoundError('VendorQuoteRequest', requestId);
      if (r.updatedAt.toISOString() !== new Date(input.seenUpdatedAt).toISOString()) throw new ConflictError('This request changed since you opened it — look at it again');
      const problem = staffMoveProblem(r.status as QuoteStatus, input.status, input.staffNote);
      if (problem) throw new ValidationError(problem);
      // "Booked" must be true: the vendor needs a live booking on this wedding first.
      if (input.status === 'BOOKED') {
        const live = await tx.vendorBooking.count({ where: { vendorId: r.vendorId, weddingEvent: { weddingId }, status: { notIn: ['DECLINED', 'CANCELLED'] } } });
        if (!live) throw new ValidationError('Add this vendor to the wedding with “Add service” first — an enquiry is not a booking');
      }
      const updated = await tx.vendorQuoteRequest.update({
        where: { id: requestId },
        data: { status: input.status, staffNote: input.staffNote?.trim() || r.staffNote, handledById: actorId, handledAt: new Date() },
      });
      // the coordinator's follow-up task is done once the couple has an answer
      await tx.task.updateMany({ where: { weddingId, title: QUOTE_TASK(r.vendor.name), status: { in: ['PENDING', 'IN_PROGRESS'] } }, data: { status: 'DONE' } });
      await log(tx, weddingId, `Quote request for ${r.vendor.name}: ${input.status.toLowerCase().replace('_', ' ')}${input.staffNote?.trim() ? ` — ${input.staffNote.trim()}` : ''}`, actorId);
      return updated;
    });
  },

  // What staff see on the wedding page: the couple's own vendors (clearly not partners) and their quote requests.
  async forStaff(weddingId: string) {
    const [own, requests] = await Promise.all([
      prisma.coupleVendor.findMany({ where: { weddingId }, orderBy: { createdAt: 'asc' }, include: { weddingEvent: { select: { type: true, label: true } } } }),
      prisma.vendorQuoteRequest.findMany({ where: { weddingId }, orderBy: { createdAt: 'asc' }, include: { functions: { select: { weddingEvent: { select: { type: true, label: true } } } }, vendor: { select: { name: true, slug: true, category: { select: { name: true } } } }, weddingEvent: { select: { type: true, label: true } } } }),
    ]);
    return { own, requests };
  },
};
