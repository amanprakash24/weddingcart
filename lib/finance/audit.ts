// Who is changing money, for the finance audit log (money design v1, PR 2, 25 Nov 2026).
//
// The log itself is written by database triggers on every money table (migration 20261125180000_finance_events), so no change can
// skip it. This only tells those triggers WHO is acting (and, optionally, why): call it first inside the transaction that changes
// money. `set_config(…, true)` lasts until that transaction ends, so it never leaks to another request on a pooled connection.
// Outside a transaction it would be lost at once — always pass the `tx` of an interactive transaction.
//
// actorId: the signed-in user's id, or a system actor — 'system:razorpay' (a gateway webhook), 'couple:link' (the couple's own
// proposal link). A money change made without this call is still logged, with no actor, and the reconciliation report counts it.

export interface AuditTx {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}

export const SYSTEM_ACTORS = { razorpay: 'system:razorpay', coupleLink: 'couple:link' } as const;

export async function auditAs(tx: AuditTx, actorId: string | null, reason?: string | null): Promise<void> {
  // A real Prisma transaction always has $executeRaw; only the unit tests' hand-made fake databases lack it.
  if (typeof (tx as Partial<AuditTx>).$executeRaw !== 'function') return;
  await tx.$executeRaw`SELECT set_config('app.actor_id', ${actorId ?? ''}, true), set_config('app.finance_reason', ${reason ?? ''}, true)`;
}
