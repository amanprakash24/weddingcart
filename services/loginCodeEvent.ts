import type { prisma } from '@/lib/prisma';

// A record of every time a couple's My Wedding login code is set, and who did it (10 Nov 2026; prisma model LoginCodeEvent).
// The record is written INSIDE the same save that sets the code — a nested create on the user's own update/create — so a code is
// never changed without its record, and no record exists for a code that was not changed.

export type CodeEventKind = 'GIVEN' | 'REPLACED' | 'RESET_ON_WHATSAPP' | 'CHANGED_BY_THEMSELVES';

/** byUserId: who did it — the couple themselves for a reset or a change of their own. via: where, as it reads today. */
export type CodeEvent = { kind: CodeEventKind; byUserId: string | null; via: string };

/** Spread into the `data` of the user.update / user.create that sets the code. */
export const codeEventWrite = (event?: CodeEvent) =>
  event ? { loginCodeEvents: { create: { kind: event.kind, byUserId: event.byUserId, via: event.via } } } : {};

/** "Kush Travel · wedding KUS-WED-2026-0002" — the wedding page a code was given or replaced from. */
export const weddingVia = (businessName: string | null | undefined, weddingNumber: string) =>
  `${businessName?.trim() || 'Shaadi Shopping'} · wedding ${weddingNumber}`;

export const VIA_COUPLE_SEARCH = 'Command Center · Couple sign-in';
export const VIA_FORGOT_CODE = 'Forgot your code? (WhatsApp)';
export const VIA_MY_WEDDING = 'My Wedding · Choose my own code';

export type CodeHistoryEntry = { kind: CodeEventKind; at: string; by: string; themselves: boolean; via: string };

/** The latest records for one person's code, newest first — for the founder's "Couple sign-in" search only. */
export async function codeHistory(db: Pick<typeof prisma, 'loginCodeEvent'>, userId: string, take = 10): Promise<CodeHistoryEntry[]> {
  const rows = await db.loginCodeEvent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    select: { kind: true, createdAt: true, via: true, byUserId: true, by: { select: { name: true, phone: true, email: true } } },
  });
  return rows.map((r) => ({
    kind: r.kind as CodeEventKind,
    at: r.createdAt.toISOString(),
    themselves: r.byUserId === userId,
    by: r.by ? r.by.name?.trim() || r.by.phone || r.by.email || 'Unnamed sign-in' : 'A sign-in that no longer exists',
    via: r.via,
  }));
}
