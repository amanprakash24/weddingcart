// The deep health check behind GET /api/health/db: can the site reach its database right now? Pure — the ping is passed in.
//
// /api/health (no database, on purpose — see its own note) answers "is the app process up". This answers "can a venue or a couple
// actually use the site": every screen that matters reads the database. A ping that hangs is a failure too, so it is given a
// time limit — a watcher must never wait for ever.

export type HealthResult = { ok: true; ms: number } | { ok: false; ms: number; reason: 'error' | 'timeout' };

export async function checkDatabase(ping: () => Promise<unknown>, timeoutMs = 5000, now: () => number = Date.now): Promise<HealthResult> {
  const started = now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const outcome = await Promise.race([
      ping().then(() => 'ok' as const),
      new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), timeoutMs);
      }),
    ]);
    return outcome === 'ok' ? { ok: true, ms: now() - started } : { ok: false, ms: now() - started, reason: 'timeout' };
  } catch {
    return { ok: false, ms: now() - started, reason: 'error' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
