// A READ-ONLY before/after check of a database (docs/deployment/rollback-checklist.md §7).
//
//   node scripts/db-snapshot.mjs take <label> [--env <file>] [--ignore-columns a,b]
//   node scripts/db-snapshot.mjs diff <labelA> <labelB>
//
// `take` counts the rows of every table in the `public` schema and hashes each table's contents, inside one
// BEGIN READ ONLY transaction — it cannot change anything. `diff` says which tables differ between two snapshots.
// Take one before a release or migration and one after: the only differences should be what the change meant to do,
// plus what real people did in between.
//
// Which database: DIRECT_URL (else DATABASE_URL) from the env file — `.env.local` by default, which is PRODUCTION.
// The host (first label hidden) and database name are printed before anything is read; check them.
//
// Snapshots are written to .db-snapshots/ (git-ignored: they describe the live database and this repository is public).
// They hold table names, row counts, hashes and migration names — never a row, a connection string or a password.
//
// A migration that ADDS a column changes that table's hash. Pass the new column names to --ignore-columns on BOTH
// snapshots to compare everything that existed before.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, '.db-snapshots');
// Tables that change by themselves from minute to minute: counted, never hashed.
const VOLATILE = new Set(['_prisma_migrations', 'login_attempts', 'otps']);
const MAX_HASHED_ROWS = 50000;
const LABEL = /^[A-Za-z0-9._-]{1,60}$/;

export function compare(a, b) {
  const names = [...new Set([...Object.keys(a.tables), ...Object.keys(b.tables)])].sort();
  const diffs = [];
  let same = 0;
  for (const n of names) {
    const x = a.tables[n];
    const y = b.tables[n];
    if (!x || !y) diffs.push(`${n}: only in the ${x ? 'first' : 'second'} snapshot`);
    else if (x.count !== y.count) diffs.push(`${n}: rows ${x.count} -> ${y.count}`);
    else if (x.sum !== y.sum) diffs.push(`${n}: same row count (${x.count}), contents differ`);
    else same++;
  }
  const before = new Set(a.migrations ?? []);
  const newMigrations = (b.migrations ?? []).filter((m) => !before.has(m));
  return { total: names.length, same, diffs, newMigrations };
}

function readEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(path.resolve(ROOT, file), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const fileFor = (label) => {
  if (!LABEL.test(label ?? '')) throw new Error('Give the snapshot a short label (letters, digits, dot, dash, underscore)');
  return path.join(OUT_DIR, `${label}.json`);
};

async function take(label, options) {
  const file = fileFor(label);
  const env = readEnv(options.env);
  const url = env.DIRECT_URL || env.DATABASE_URL;
  if (!url) throw new Error(`No DIRECT_URL or DATABASE_URL in ${options.env}`);
  const u = new URL(url);
  const local = u.hostname === '127.0.0.1' || u.hostname === 'localhost';
  const host = local ? u.hostname : u.hostname.replace(/^[^.]+/, '***');
  const database = u.pathname.slice(1) || 'postgres';
  console.log(`database: ${database} on ${host}:${u.port || 5432} (from ${options.env}) — read-only`);

  const { Client } = (await import('pg')).default;
  const client = new Client({ host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database, ssl: local ? false : { rejectUnauthorized: false } });
  await client.connect();
  const out = { takenAt: new Date().toISOString(), host, database, ignoredColumns: options.ignore, tables: {}, migrations: [] };
  try {
    await client.query('BEGIN READ ONLY');
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")).rows.map((r) => r.tablename);
    for (const t of tables) {
      const name = `"${t.replace(/"/g, '""')}"`;
      const count = Number((await client.query(`SELECT count(*)::int AS n FROM ${name}`)).rows[0].n);
      let sum = null;
      if (!VOLATILE.has(t) && count <= MAX_HASHED_ROWS) {
        const q = `SELECT md5(coalesce(string_agg(h, '' ORDER BY h), '')) AS sum FROM (SELECT md5((to_jsonb(x) - $1::text[])::text) AS h FROM ${name} x) s`;
        sum = (await client.query(q, [options.ignore])).rows[0].sum;
      }
      out.tables[t] = { count, sum };
    }
    if (tables.includes('_prisma_migrations'))
      out.migrations = (await client.query('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY 1')).rows.map((r) => r.migration_name);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  const rows = Object.values(out.tables);
  console.log(`tables: ${rows.length} | rows: ${rows.reduce((n, v) => n + v.count, 0)} | migrations applied: ${out.migrations.length}${out.migrations.length ? ` (latest ${out.migrations.at(-1)})` : ''}`);
  console.log(`saved: .db-snapshots/${label}.json`);
}

function diff(labelA, labelB) {
  const [a, b] = [labelA, labelB].map((l) => JSON.parse(fs.readFileSync(fileFor(l), 'utf8')));
  if (a.database !== b.database || a.host !== b.host) console.log(`NOTE: different databases — ${a.database} on ${a.host} vs ${b.database} on ${b.host}`);
  if (JSON.stringify(a.ignoredColumns ?? []) !== JSON.stringify(b.ignoredColumns ?? [])) console.log('NOTE: the two snapshots ignore different columns — their hashes cannot be compared');
  const r = compare(a, b);
  console.log(`${labelA} (${a.takenAt}) vs ${labelB} (${b.takenAt})`);
  console.log(`identical tables: ${r.same} of ${r.total}`);
  if (r.newMigrations.length) console.log(`migrations applied in between:\n  ${r.newMigrations.join('\n  ')}`);
  console.log(r.diffs.length ? `DIFFERENT:\n  ${r.diffs.join('\n  ')}` : 'no differences');
}

export function parse(argv) {
  /** @type {string[]} */
  const positional = [];
  /** @type {{ env: string; ignore: string[] }} */
  const options = { env: '.env.local', ignore: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--env') options.env = argv[++i] ?? '';
    else if (argv[i] === '--ignore-columns') options.ignore = (argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean).sort();
    else positional.push(argv[i]);
  }
  return { positional, options };
}

async function main() {
  const { positional, options } = parse(process.argv.slice(2));
  const [command, a, b] = positional;
  if (command === 'take' && a) return take(a, options);
  if (command === 'diff' && a && b) return diff(a, b);
  console.log('Usage:\n  node scripts/db-snapshot.mjs take <label> [--env <file>] [--ignore-columns a,b]\n  node scripts/db-snapshot.mjs diff <labelA> <labelB>');
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('FAILED:', e.message);
    process.exit(1);
  });
}
