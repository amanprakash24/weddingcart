import { consultationRepository } from '@/repositories/consultation.repository';
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

  delete: (id: string) => consultationRepository.delete(id),
};
