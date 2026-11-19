// Which functions a guest is invited to (Client OS guest management, approved 19 Nov 2026).
// A guest's response rows (GuestFunctionResponse) are also their invitations. A guest with NO rows is invited to every
// function — how every guest worked before this change — so existing guests keep seeing all functions. Pure.

export function invitedEventIds(responseEventIds: string[], allEventIds: string[]): string[] {
  if (responseEventIds.length === 0) return [...allEventIds];
  const invited = new Set(responseEventIds);
  return allEventIds.filter((id) => invited.has(id));
}

/** The answers a guest may save from their RSVP link: only for functions they are invited to, one per function. */
export function answersForInvited<T extends { weddingEventId: string }>(answers: T[], invited: string[]): T[] {
  const allowed = new Set(invited);
  const seen = new Set<string>();
  return answers.filter((a) => {
    if (!allowed.has(a.weddingEventId) || seen.has(a.weddingEventId)) return false;
    seen.add(a.weddingEventId);
    return true;
  });
}
