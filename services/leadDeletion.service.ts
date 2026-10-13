import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { Role } from '@/lib/auth/roles';
import { subjectWhere } from '@/lib/crm/subject';
import type { SourceType } from '@/services/leadInbox.service';

// "Delete lead" in the CRM (13 Oct 2026) — the founder removes a lead for good: a test entry, a wrong number, a duplicate.
//
// THE RULES THIS FILE EXISTS TO KEEP:
//   - Founder (SUPER_ADMIN) only, read from the database for the signed-in person — never trusted from the request.
//   - Only a lead that is still JUST a lead. Once there is a booking (and the agreement frozen with it), a wedding, an invoice or a payment
//     the couple says they made, it is a customer record with money and history attached; it is refused here, by name, and
//     nothing is deleted. (Those are closed or cancelled through their own screens.)
//   - What goes with the lead: its tasks, notes and history, its insights, its quotations (never booked, by the rule above), and
//     what Shaadi Shopping asked vendors about it. An enquiry that was made from a deleted consultation stays, on its own.
//   - All or nothing: one transaction.
// The lead is read through the caller's business scope (lib/ownership), so a lead of another business is simply not found.

type Db = typeof prisma;

export interface LeadDeletionDeps {
  db: Db;
}

export interface DeleteCheck {
  name: string;
  canDelete: boolean;
  blockers: string[]; // why not, in plain words
  goesWith: { quotations: number; tasks: number; notes: number; vendorEnquiries: number };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function createLeadDeletionService(deps: LeadDeletionDeps = { db: prisma }) {
  async function founder(actorId: string) {
    const me = await deps.db.user.findUnique({ where: { id: actorId }, select: { roles: { select: { role: true } } } });
    if (!me || !me.roles.some((r) => r.role === Role.SUPER_ADMIN)) throw new NotFoundError('Lead', 'delete');
  }

  async function nameOf(db: Db, sourceType: SourceType, id: string): Promise<string | null> {
    if (sourceType === 'LEAD') {
      const row = await db.lead.findUnique({ where: { id }, select: { phone: true } });
      return row ? row.phone : null;
    }
    const row = sourceType === 'ENQUIRY' ? await db.enquiry.findUnique({ where: { id }, select: { name: true, phone: true } }) : await db.consultation.findUnique({ where: { id }, select: { name: true, phone: true } });
    return row ? row.name || row.phone : null;
  }

  async function check(db: Db, sourceType: SourceType, id: string): Promise<DeleteCheck> {
    const name = await nameOf(db, sourceType, id);
    if (name === null) throw new NotFoundError('Lead', id);
    const subject = subjectWhere(sourceType, id);

    const quotations = await db.quotation.findMany({
      where: subject,
      select: { id: true, booking: { select: { id: true } }, agreement: { select: { id: true } }, _count: { select: { invoices: true, paymentSubmissions: true } } },
    });
    // A booking made straight from the website form (no quotation) points at the enquiry / consultation itself.
    const directBookings = sourceType === 'LEAD' ? 0 : await db.booking.count({ where: sourceType === 'ENQUIRY' ? { enquiryId: id } : { consultationId: id } });
    const wedding = await db.wedding.findFirst({
      where: sourceType === 'LEAD' ? { sourceLeadId: id } : sourceType === 'ENQUIRY' ? { OR: [{ sourceEnquiryId: id }, { sourceBooking: { enquiryId: id } }] } : { OR: [{ sourceConsultationId: id }, { sourceBooking: { consultationId: id } }] },
      select: { weddingNumber: true },
    });

    const booked = quotations.filter((q) => q.booking).length + directBookings;
    const agreements = quotations.filter((q) => q.agreement).length;
    const invoices = quotations.reduce((n, q) => n + q._count.invoices, 0);
    const claims = quotations.reduce((n, q) => n + q._count.paymentSubmissions, 0);
    const blockers = [
      wedding ? `it became wedding ${wedding.weddingNumber}` : null,
      booked ? `it has ${plural(booked, 'booking')}` : null,
      agreements ? `it has ${plural(agreements, 'booking agreement')}` : null,
      invoices ? `it has ${plural(invoices, 'invoice')}` : null,
      claims ? `the couple reported ${plural(claims, 'payment')}` : null,
    ].filter((b): b is string => b !== null);

    const [tasks, notes, vendorEnquiries] = await Promise.all([db.task.count({ where: subject }), db.activityLog.count({ where: subject }), db.vendorEnquiry.count({ where: subject })]);
    return { name, canDelete: blockers.length === 0, blockers, goesWith: { quotations: quotations.length, tasks, notes, vendorEnquiries } };
  }

  return {
    // What deleting would do — shown to the founder before they confirm.
    async preview(actorId: string, sourceType: SourceType, id: string): Promise<DeleteCheck> {
      await founder(actorId);
      return check(deps.db, sourceType, id);
    },

    async remove(actorId: string, sourceType: SourceType, id: string): Promise<{ deleted: true; name: string }> {
      await founder(actorId);
      return deps.db.$transaction(async (tx) => {
        const db = tx as unknown as Db;
        const found = await check(db, sourceType, id); // again, inside the transaction: nothing may have been booked meanwhile
        if (!found.canDelete) throw new ConflictError(`This lead cannot be deleted: ${found.blockers.join(', ')}. It is a customer record now.`);
        const subject = subjectWhere(sourceType, id);
        await db.task.deleteMany({ where: subject });
        await db.activityLog.deleteMany({ where: subject });
        await db.leadInsight.deleteMany({ where: subject });
        await db.quotation.deleteMany({ where: subject }); // its lines, payment links and proposal visits go with it
        if (sourceType === 'CONSULTATION') await db.enquiry.updateMany({ where: { consultationId: id }, data: { consultationId: null } });
        // Vendor enquiries (and a consultation's vendor choices) are removed by the database with their lead.
        if (sourceType === 'LEAD') await db.lead.delete({ where: { id } });
        else if (sourceType === 'ENQUIRY') await db.enquiry.delete({ where: { id } });
        else await db.consultation.delete({ where: { id } });
        console.info(`[lead-delete] ${actorId} deleted ${sourceType} ${id} with ${found.goesWith.quotations} quotation(s), ${found.goesWith.tasks} task(s), ${found.goesWith.notes} history entries`);
        return { deleted: true as const, name: found.name };
      });
    },
  };
}

export const leadDeletionService = createLeadDeletionService();
