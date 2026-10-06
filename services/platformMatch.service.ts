import { ActivityType } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { PLATFORM_BUSINESS_ID } from '@/lib/ownership/owned';
import { runAsSystem } from '@/lib/ownership/scope';
import { subjectCreateData } from '@/lib/crm/subject';
import type { SourceType } from '@/services/leadInbox.service';

// Decision D4 (docs/wedding-os/15-record-ownership.md §4.4): when a venue adds its OWN enquiry for a couple Shaadi Shopping already
// brought to THAT SAME venue, the two are linked and commission applies. This is the one deliberate cross-business lookup, so it runs
// as a named SYSTEM scope (allowlisted in CI) and reads only what the rule needs — Shaadi Shopping's OWN records (businessId =
// platform) that involve this vendor, matched by mobile. The venue learns only "came through Shaadi Shopping"; Shaadi Shopping
// learns only that the venue added this couple. Nothing else crosses either way.
//
// A Shaadi Shopping record involves the vendor when: it is a marketplace enquiry about the vendor; Shaadi Shopping asked the vendor
// for availability for it; the vendor was picked for it in a consultation; a quotation line names the vendor; or a cart booking
// includes the vendor. Lost / closed records do not count.

export type PlatformMatchRef = `${'ENQUIRY' | 'CONSULTATION' | 'LEAD' | 'BOOKING'}:${string}`;

const mobileKey = (phone: string) => phone.replace(/\D/g, '').slice(-10);
const OPEN_STAGE = { notIn: ['LOST'] as ('LOST')[] };

export interface PlatformMatchDeps {
  db: typeof prisma;
}

const defaultDeps = (): PlatformMatchDeps => ({ db: prisma });

export function createPlatformMatchService(deps: PlatformMatchDeps = defaultDeps()) {
  const { db } = deps;
  const platform = { businessId: PLATFORM_BUSINESS_ID };

  return {
    // The most recent open Shaadi Shopping record for this mobile that involves this vendor, or null.
    async find(vendorId: string, phone: string): Promise<PlatformMatchRef | null> {
      const key = mobileKey(phone);
      if (key.length !== 10) return null;
      const phoneMatch = { endsWith: key };
      return runAsSystem('D4: same couple from Shaadi Shopping for this venue', async () => {
        const viaVendor = (relation: 'vendorEnquiries' | 'vendorSelections' | 'quotations') =>
          relation === 'quotations' ? { quotations: { some: { items: { some: { vendorId } } } } } : relation === 'vendorSelections' ? { vendorSelections: { some: { vendorId } } } : { vendorEnquiries: { some: { vendorId } } };

        const [enquiry, consultation, lead, booking] = await Promise.all([
          db.enquiry.findFirst({
            where: { ...platform, phone: phoneMatch, pipelineStage: OPEN_STAGE, OR: [{ vendorId }, viaVendor('vendorEnquiries'), viaVendor('quotations')] },
            select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' },
          }),
          db.consultation.findFirst({
            where: { ...platform, phone: phoneMatch, pipelineStage: OPEN_STAGE, OR: [viaVendor('vendorEnquiries'), viaVendor('vendorSelections'), viaVendor('quotations')] },
            select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' },
          }),
          db.lead.findFirst({
            where: { ...platform, phone: phoneMatch, pipelineStage: OPEN_STAGE, OR: [viaVendor('vendorEnquiries'), viaVendor('quotations')] },
            select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' },
          }),
          db.booking.findFirst({
            where: { ...platform, phone: phoneMatch, status: { not: 'CLOSED' }, items: { some: { vendorId } } },
            select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' },
          }),
        ]);
        const found = [
          enquiry && { ref: `ENQUIRY:${enquiry.id}` as const, at: enquiry.createdAt },
          consultation && { ref: `CONSULTATION:${consultation.id}` as const, at: consultation.createdAt },
          lead && { ref: `LEAD:${lead.id}` as const, at: lead.createdAt },
          booking && { ref: `BOOKING:${booking.id}` as const, at: booking.createdAt },
        ].filter((x): x is { ref: PlatformMatchRef; at: Date } => !!x);
        found.sort((a, b) => b.at.getTime() - a.at.getTime());
        return found[0]?.ref ?? null;
      });
    },

    // Tell Shaadi Shopping, on ITS record, that the venue added this couple directly — and that commission applies. A booking has no
    // timeline of its own, so its note goes on the enquiry / consultation it came from, if any.
    async noteOnPlatformRecord(ref: PlatformMatchRef, venueName: string): Promise<void> {
      await runAsSystem('D4: note on the Shaadi Shopping record', async () => {
        const [type, id] = ref.split(':') as ['ENQUIRY' | 'CONSULTATION' | 'LEAD' | 'BOOKING', string];
        let subject: { sourceType: SourceType; id: string } | null = type === 'BOOKING' ? null : { sourceType: type, id };
        if (type === 'BOOKING') {
          const b = await db.booking.findUnique({ where: { id }, select: { enquiryId: true, consultationId: true } });
          subject = b?.consultationId ? { sourceType: 'CONSULTATION', id: b.consultationId } : b?.enquiryId ? { sourceType: 'ENQUIRY', id: b.enquiryId } : null;
        }
        if (!subject) return;
        await db.activityLog.create({
          data: {
            type: ActivityType.STATUS_CHANGED,
            summary: `${venueName} added this couple to its own Vivah OS enquiries — linked to this record; commission applies to the booking`,
            ...subjectCreateData(subject.sourceType, subject.id),
          },
        });
      });
    },
  };
}

export const platformMatchService = createPlatformMatchService();
