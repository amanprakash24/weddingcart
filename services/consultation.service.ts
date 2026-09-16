import { consultationRepository } from '@/repositories/consultation.repository';
import { bookingRepository } from '@/repositories/booking.repository';
import { findWeddingForSource } from '@/services/weddingConversion.service';
import { ConversionLockedError, InvalidTransitionError } from '@/lib/errors';
import type { Prisma, ConsultationStatus } from '@/generated/prisma/client';

export const consultationService = {
  async list(params: { status?: ConsultationStatus }) {
    return consultationRepository.findMany({
      where: params.status ? { status: params.status } : {},
      orderBy: { createdAt: 'desc' },
    });
  },

  create: consultationRepository.create,

  // Hard boundary: only `status` (the legacy tri-state field) is ever passed
  // in by the route. pipelineStage/assignedTo/tasks/activities/wedding are
  // the CRM's own fields, owned exclusively by leadWorkspaceService's
  // controlled state machine — never touched here.
  update: (id: string, data: Prisma.ConsultationUpdateInput) => consultationRepository.update(id, data),

  // Production-integrity fix — see services/enquiry.service.ts's identical
  // delete() for the full reasoning (Wedding.sourceConsultationId and
  // Booking.consultationId both default to onDelete: SetNull; this mirrors
  // the same guard already shipped for Lead in lead.service.ts, plus the
  // linked-Booking check Lead doesn't need).
  async delete(id: string) {
    const wedding = await findWeddingForSource('CONSULTATION', id);
    const linkedBookings = wedding ? 0 : await bookingRepository.count({ consultationId: id });
    const blocked = evaluateConsultationDeleteGuard(wedding, linkedBookings);
    if (blocked) throw blocked;
    return consultationRepository.delete(id);
  },
};

// Pure decision behind delete()'s guard — see services/enquiry.service.ts's
// identical evaluateEnquiryDeleteGuard for the full reasoning, including why
// this is a standalone function rather than mocking prisma/repositories/
// weddingConversion.service directly.
export function evaluateConsultationDeleteGuard(
  wedding: { weddingNumber: string } | null,
  linkedBookingCount: number
): Error | null {
  if (wedding) {
    return new ConversionLockedError(`Cannot delete: this consultation converted to Wedding ${wedding.weddingNumber}`);
  }
  if (linkedBookingCount > 0) {
    return new InvalidTransitionError(`Cannot delete: this consultation has ${linkedBookingCount} linked booking(s)`);
  }
  return null;
}
