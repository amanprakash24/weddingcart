// The watcher: is the live site usable right now? Run by .github/workflows/watch-live.yml every 15 minutes, or by hand:
//
//   node scripts/watch-live.mjs                      # checks https://www.shaadishopping.com
//   node scripts/watch-live.mjs http://localhost:3001
//
// It only makes ordinary signed-out GET requests to public addresses — no login, no secrets, nothing written anywhere. It never
// opens a couple's link (that page records each visit). Exit code 0 = every check passed, 1 = at least one failed after retries.

export const DEFAULT_BASE = 'https://www.shaadishopping.com';

/**
 * What must be true of the live site. `status` is the exact answer expected; `json` / `text` look inside the body.
 * @type {{ name: string; path: string; status: number; json?: Record<string, unknown>; text?: string }[]}
 */
export const CHECKS = [
  { name: 'Home page opens', path: '/', status: 200, text: 'Shaadi' },
  { name: 'Vendor OS login page opens', path: '/vendor/login', status: 200 },
  { name: 'App is up', path: '/api/health', status: 200, json: { status: 'ok' } },
  { name: 'Database can be reached', path: '/api/health/db', status: 200, json: { status: 'ok' } },
  // Signed out, Vendor OS must refuse politely. A 500 here means its entry is broken; a 200 would mean it is open to anyone.
  { name: 'Vendor OS refuses a signed-out request', path: '/api/vendor-os/enquiries', status: 401 },
];

/**
 * Pure: does this answer satisfy the check? Returns null when it does, else why not (short, with nothing from the body).
 * @param {(typeof CHECKS)[number]} check
 * @param {{ status: number; body: string }} res
 * @returns {string | null}
 */
export function evaluate(check, res) {
  if (res.status !== check.status) return `answered ${res.status}, expected ${check.status}`;
  if (check.json) {
    let parsed;
    try {
      parsed = JSON.parse(res.body);
    } catch {
      return 'did not answer with JSON';
    }
    for (const [key, want] of Object.entries(check.json)) {
      if (parsed?.[key] !== want) return `"${key}" was not "${String(want)}"`;
    }
  }
  if (check.text && !res.body.includes(check.text)) return `the page did not contain "${check.text}"`;
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One check, tried up to `tries` times: a single slow answer or network blip must not raise an alarm.
 * @param {string} base
 * @param {(typeof CHECKS)[number]} check
 * @param {{ tries?: number; gapMs?: number; timeoutMs?: number; fetchFn?: typeof fetch }} [opts]
 * @returns {Promise<{ name: string; ok: boolean; why: string | null; tries: number }>}
 */
export async function runCheck(base, check, { tries = 3, gapMs = 20000, timeoutMs = 30000, fetchFn = fetch } = {}) {
  let why = null;
  for (let n = 1; n <= tries; n++) {
    try {
      const r = await fetchFn(base + check.path, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'shaadishopping-watch-live' } });
      why = evaluate(check, { status: r.status, body: await r.text() });
    } catch (err) {
      why = err instanceof Error && err.name === 'TimeoutError' ? `no answer in ${timeoutMs / 1000}s` : 'could not connect';
    }
    if (why === null) return { name: check.name, ok: true, why: null, tries: n };
    if (n < tries) await sleep(gapMs);
  }
  return { name: check.name, ok: false, why, tries };
}

async function main() {
  const base = (process.argv[2] || DEFAULT_BASE).replace(/\/$/, '');
  console.log(`Checking ${base}`);
  const results = [];
  for (const check of CHECKS) {
    const r = await runCheck(base, check);
    results.push(r);
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? (r.tries > 1 ? ` (on try ${r.tries})` : '') : ` — ${r.why}`}`);
  }
  const failed = results.filter((r) => !r.ok);
  // For the workflow: a short summary it can put in an issue.
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `failed=${failed.map((f) => `${f.name} — ${f.why}`).join('; ')}\n`);
  }
  if (failed.length) {
    console.log(`\n${failed.length} of ${results.length} checks failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} checks passed.`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop() ?? '')) await main();
