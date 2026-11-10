import { ActivityType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { runInScope } from '@/lib/ownership/scope';
import { subjectCreateData } from '@/lib/crm/subject';
import { EVENT_KINDS, validateNewEnquiry, type NewEnquiry } from '@/lib/venue/enquiry';
import { venueEnquiryService } from '@/services/venueEnquiry.service';
import type { SourceType } from '@/services/leadInbox.service';

// Shaadi Shopping hands an enquiry to a venue's Vivah OS (11 Nov 2026, Vivah OS phase 4; decision of 10 Nov 2026: a Shaadi Shopping
// enquiry for a Vivah OS venue goes straight into the venue's own Enquiries — replacing 15-record-ownership.md §4.4's route).
//
//  - Automatically: a couple's enquiry on a venue's Shaadi Shopping listing (app/api/enquiries) is sent to that venue.
//  - By the team: "Send to a venue" on any Shaadi Shopping enquiry in the CRM (listing enquiry, /plan consultation, callback lead).
//
// Shaadi Shopping's record stays Shaadi Shopping's (its CRM is unchanged). The venue gets a copy in ITS business, through the one
// intake every enquiry uses (services/venueEnquiry.service.ts `intake`), marked "Shaadi Shopping" and linked to Shaadi Shopping's
// record — so the commission applies (D4/D5). The venue learns only this couple's details; nothing else crosses. Only a venue that
// is actually on Vivah OS (has signed in: a business with a current member) receives one; for any other, nothing is sent and the
// team calls them as before.
//
// Runs inside Shaadi Shopping's scope (its routes are platform-scoped); only the intake step runs as the venue.

export type HandoffStatus = 'SENT' | 'ADDED_TO_OPEN' | 'NOT_ON_VIVAH_OS';
export interface VenueOnVivahOs { vendorId: string; name: string; city: string | null; category: string | null }

export interface PlatformHandoffDeps {
  db: {
    enquiry: Pick<typeof prisma.enquiry, 'findFirst'>;
    consultation: Pick<typeof prisma.consultation, 'findFirst'>;
    lead: Pick<typeof prisma.lead, 'findFirst'>;
    business: Pick<typeof prisma.business, 'findFirst' | 'findMany'>;
    vendor: Pick<typeof prisma.vendor, 'findUnique'>;
    user: Pick<typeof prisma.user, 'findUnique'>;
    activityLog: Pick<typeof prisma.activityLog, 'create'>;
  };
  intake: typeof venueEnquiryService.intake;
  today: () => string; // YYYY-MM-DD in India
}

const defaultDeps = (): PlatformHandoffDeps => ({
  db: prisma,
  intake: (e, how) => venueEnquiryService.intake(e, how),
  today: () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()),
});

// A venue on Vivah OS: its business, with someone currently in it (it signs in and would see the enquiry).
const ON_VIVAH_OS = { kind: 'VENDOR' as const, members: { some: { removedAt: null } } };

// "Wedding", "wedding ", "Reception" … → one of the event kinds; anything unknown is "other"; nothing said is a wedding. Pure.
export function eventKindOf(raw: string | null | undefined): string {
  const v = (raw ?? '').trim().toLowerCase();
  if (!v) return 'wedding';
  return EVENT_KINDS.find((k) => k.id === v || k.label.toLowerCase() === v)?.id ?? (v.includes('wedding') || v.includes('shaadi') || v.includes('reception') ? 'wedding' : 'other');
}

// "200-300", "about 250", "300+" → 200 / 250 / 300; nothing usable → 0. Pure.
export function guestsOf(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return Number.isInteger(raw) && raw > 0 && raw <= 100000 ? raw : 0;
  const n = Number((raw ?? '').match(/\d+/)?.[0] ?? 0);
  return n > 0 && n <= 100000 ? n : 0;
}

export function createPlatformHandoffService(deps: PlatformHandoffDeps = defaultDeps()) {
  const { db } = deps;

  // What the venue is told, from Shaadi Shopping's record — in the venue intake's own words (lib/venue/enquiry.ts).
  async function customerOf(sourceType: SourceType, id: string): Promise<{ input: Record<string, unknown>; vendorId: string | null }> {
    const today = deps.today();
    const futureDay = (d: string | null | undefined) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today ? d : '');
    if (sourceType === 'ENQUIRY') {
      const r = await db.enquiry.findFirst({ where: { id }, select: { name: true, phone: true, eventType: true, eventDate: true, guestCount: true, message: true, vendorId: true } });
      if (!r) throw new NotFoundError('Enquiry', id);
      return { vendorId: r.vendorId, input: { name: r.name, phone: r.phone, eventType: eventKindOf(r.eventType), weddingDate: futureDay(r.eventDate), guestCount: guestsOf(r.guestCount), need: r.message?.trim().slice(0, 500) || '' } };
    }
    if (sourceType === 'CONSULTATION') {
      const r = await db.consultation.findFirst({ where: { id }, select: { name: true, phone: true, eventType: true, weddingDate: true, days: true, guestCount: true, totalBudget: true, message: true, services: true } });
      if (!r) throw new NotFoundError('Consultation', id);
      const need = [r.services.length ? `Looking for: ${r.services.join(', ')}` : '', r.message?.trim() ?? ''].filter(Boolean).join('\n').slice(0, 500);
      return {
        vendorId: null,
        input: { name: r.name, phone: r.phone, eventType: eventKindOf(r.eventType), weddingDate: futureDay(r.weddingDate), days: Math.min(Math.max(r.days || 1, 1), 7), guestCount: guestsOf(r.guestCount), budget: r.totalBudget && r.totalBudget > 0 ? r.totalBudget : '', need },
      };
    }
    const r = await db.lead.findFirst({ where: { id }, select: { phone: true } });
    if (!r) throw new NotFoundError('Lead', id);
    // A callback request leaves only a mobile number.
    return { vendorId: null, input: { name: 'Shaadi Shopping customer', phone: r.phone, need: 'Asked Shaadi Shopping for a call back — details not given yet' } };
  }

  async function noteOnRecord(sourceType: SourceType, id: string, summary: string, actorId: string | null) {
    await db.activityLog.create({ data: { type: ActivityType.STATUS_CHANGED, summary, ...subjectCreateData(sourceType, id), performedBy: actorId ? { connect: { id: actorId } } : undefined } });
  }

  async function venueFor(vendorId: string) {
    return db.business.findFirst({ where: { vendorId, ...ON_VIVAH_OS }, select: { id: true, name: true } });
  }

  return {
    // The venues the team can send to: those on Vivah OS, by name.
    async venues(): Promise<VenueOnVivahOs[]> {
      const rows = await db.business.findMany({
        where: { vendorId: { not: null }, ...ON_VIVAH_OS },
        select: { vendorId: true, name: true, vendor: { select: { city: true, category: { select: { name: true } } } } },
        orderBy: { name: 'asc' },
        take: 500,
      });
      return rows.map((b) => ({ vendorId: b.vendorId as string, name: b.name, city: b.vendor?.city?.trim() || null, category: b.vendor?.category?.name ?? null }));
    },

    // Send one Shaadi Shopping enquiry to one venue. `actorId` null = sent automatically (the couple's listing enquiry).
    async send(input: { sourceType: SourceType; sourceId: string; vendorId: string; actorId: string | null }): Promise<{ status: HandoffStatus; venueName: string }> {
      const { sourceType, sourceId, vendorId, actorId } = input;
      const customer = await customerOf(sourceType, sourceId);
      const venue = await venueFor(vendorId);
      if (!venue) {
        const listing = await db.vendor.findUnique({ where: { id: vendorId }, select: { name: true } });
        if (!listing) throw new NotFoundError('Vendor', vendorId);
        // Told on the record only when it was automatic — the team, sending by hand, is told on screen.
        if (!actorId) await noteOnRecord(sourceType, sourceId, `${listing.name} is not on Vivah OS yet — not sent there; call them`, null);
        return { status: 'NOT_ON_VIVAH_OS', venueName: listing.name };
      }

      const checked = validateNewEnquiry({ ...customer.input, channel: 'OTHER' }, deps.today());
      if (!checked.ok) throw new ValidationError(`This enquiry cannot be sent: ${Object.values(checked.errors)[0]}`);
      const e: NewEnquiry = { ...checked.value, channel: 'SHAADI_SHOPPING' };

      const result = await runInScope({ kind: 'BUSINESS', businessId: venue.id, role: 'STAFF' }, () =>
        deps.intake(e, { sourceDetail: null, actorId: null, platformRef: `${sourceType}:${sourceId}` })
      );

      const by = actorId ? (await db.user.findUnique({ where: { id: actorId }, select: { name: true } }))?.name?.trim() : null;
      await noteOnRecord(
        sourceType,
        sourceId,
        `${actorId ? 'Sent' : 'Sent automatically'} to ${venue.name}’s Vivah OS${by ? ` by ${by}` : ''}${result.repeat ? ' — added to the enquiry they already had there' : ''}; commission applies when they book`,
        actorId
      );
      return { status: result.repeat ? 'ADDED_TO_OPEN' : 'SENT', venueName: venue.name };
    },

    // A couple's enquiry on a venue's listing goes to that venue at once. Best effort: the couple's enquiry is already saved in
    // Shaadi Shopping's CRM, so a failure here is only noted there for the team — never shown to the couple.
    async sendListingEnquiry(enquiryId: string): Promise<void> {
      try {
        const r = await db.enquiry.findFirst({ where: { id: enquiryId }, select: { vendorId: true } });
        if (!r?.vendorId) return;
        await this.send({ sourceType: 'ENQUIRY', sourceId: enquiryId, vendorId: r.vendorId, actorId: null });
      } catch (err) {
        console.error('Sending a listing enquiry to the venue failed (the enquiry is saved):', err instanceof Error ? err.message : err);
        try {
          await noteOnRecord('ENQUIRY', enquiryId, 'Could not send this enquiry to the venue’s Vivah OS automatically — please send it from here or call the venue', null);
        } catch { /* the note is a courtesy; the enquiry itself is safe */ }
      }
    },
  };
}

export const platformHandoffService = createPlatformHandoffService();
