import { prisma } from '@/lib/prisma';

// Small shared batch name-lookup, same pattern leadInboxService.ts already
// uses inline for lead-row assignees — pulled out here since the Lead
// Workspace needs it for two more relations (task assignee, activity performer).
export async function resolveUserNames(ids: (string | null | undefined)[]): Promise<Map<string, string | null>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => !!id))];
  if (uniqueIds.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, name: true } });
  return new Map(users.map((u) => [u.id, u.name]));
}
