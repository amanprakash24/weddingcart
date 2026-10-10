# Rollback and Recovery Checklist

Rewritten 10 Oct 2026 for the system as it runs today: **Next.js on Vercel, PostgreSQL on Supabase, Prisma migrations**. The
earlier version of this file described going back to MongoDB; that database is gone and that procedure no longer applies (it is in
this file's git history).

Every statement here is marked **Verified** (done for real, with the date) or **Not rehearsed** (the standard way, never tried on
this project). Do not treat a "Not rehearsed" step as safe under pressure — rehearse it first (§8).

No secret belongs in this file. It names where each secret lives, never its value.

## 1. What can be rolled back, and what cannot

| Thing | Where it lives | Going back |
|---|---|---|
| Code | GitHub `main` → Vercel builds every push | Easy: revert the merge, or promote an older deployment (§4) |
| Database structure | Supabase Postgres, changed only by `prisma/migrations/*` | **Forward only.** No migration here has a "down" script (§5) |
| Database rows | The same database | Only from the nightly backup (§3, §6). Anything written after that backup is lost in a full restore |
| Photos and files | Cloudinary | **Not in the backup.** The database only holds their addresses |
| Settings and secrets | Vercel environment variables, GitHub secrets of the backup repository, `.env.local` on the dev machine | Not in any backup — kept by the owner |

Two rules follow from this table:

1. **A code problem is fixed by rolling back code.** Never restore the database to fix a code bug.
2. **A migration is a one-way door.** So the checks happen *before* it (§2), and every migration is written so the previous
   code still runs after it (§5).

## 2. Before every production migration

The standing order is **backup → migrate → merge → live check**. All five boxes, every time:

- [ ] **Fresh backup.** Run the backup workflow by hand ("Run workflow") and wait for the green tick. A backup from last night
      is not fresh if anything was booked or paid today.
- [ ] **Backup is readable.** The workflow itself decrypts the file again and counts its tables (it fails under 50). Check that
      the run's log line says so. *Verified on every run since 28 Sep 2026.*
- [ ] **Right database.** `npx prisma migrate status` prints the datasource it will use — read the host and database name before
      going on. The Prisma CLI reads `DIRECT_URL` from `.env.local` (`prisma.config.ts`), which is **production**.
- [ ] **Migration read line by line.** Open the `.sql` file. Anything that drops, renames, narrows a column, or rewrites rows
      needs its own written plan for the previous code and for the data.
- [ ] **Rehearsed on a copy.** Restore the fresh backup into a scratch database (§6.1), apply the migration there, run the app
      against it and click through the changed screens. *Verified for PR #174 (7 Oct 2026).*

Only then: `npx prisma migrate deploy`, run by the owner. Then `npx prisma migrate status` must say the database is up to date,
and only then is the pull request merged.

Changes with **no migration** (most of them) need none of this — only §4 if they go wrong.

## 3. The backups

- **What:** a nightly `pg_dump` of the `public` schema (custom format), encrypted with GPG AES-256. Only the encrypted file is
  kept. It runs at 02:00 India time and on demand. *Verified: every scheduled run from 7 to 10 Oct 2026 succeeded.*
- **Where:** the private repository `shaadishopping-db-backups`, as workflow artifacts. **Kept for 90 days**, then deleted by GitHub.
- **To read one you need all three:** access to that repository, the backup passphrase, and a PostgreSQL 17 client.
- **The passphrase** is in the repository's `BACKUP_PASSPHRASE` secret (GitHub never shows a secret again) and in the owner's own
  safe copy. **If the owner's copy is lost, every backup is unreadable.** Never replace the secret with a new passphrase: backups
  made with the old one could no longer be opened.
- **Supabase's own backups:** the project was on the Free plan when the nightly backup was set up (28 Sep 2026), which has none.
  *Assumption — confirm in the Supabase dashboard before relying on either answer.*
- **Not in the backup:** Cloudinary files, Vercel settings, secrets, and anything outside the `public` schema.

## 4. Rolling back code (no migration involved)

First decide it is the code: the live check failed right after a deploy, and the same thing worked before it.

**Way 1 — revert on GitHub.** *Verified path: every production deploy on this project is a build of a `main` commit.*

1. Open the merged pull request → **Revert** → merge the revert pull request (or `git revert -m 1 <merge commit>` on a branch,
   then a pull request). Never push to `main` directly.
2. Wait for the production deployment of the new commit to finish.
3. Run the live check (§7).

**Way 2 — promote the previous deployment in Vercel.** *Not rehearsed on this project.* Vercel → the project → Deployments → the
last good production deployment → "Promote to Production" (or "Instant Rollback"). It is faster than a build, but `main` still
holds the bad code: the next merge would ship it again, so do Way 1 straight after.

Things that have gone wrong here before:

- This repository is linked to **two** Vercel projects with separate settings. Check which one serves the live domain before
  acting. Only one of them builds from GitHub.
- Never use "Redeploy" on a deployment that was uploaded from a laptop — it reuses that upload, not the code on GitHub.
- A deployment keeps the environment variables it was built with. Changing a variable changes nothing until a new deployment
  succeeds.

## 5. When a migration is involved

There is no "down" migration, and **nobody runs SQL by hand on production to undo one.** Instead:

**Write migrations so the previous code keeps working.** Add tables and columns (nullable, or with a default); do not drop,
rename or tighten in the same release that stops using something. Then a bad release is just §4: roll the code back and leave the
new columns where they are — they are harmless.

**If the migration itself fails half-way:**

1. Stop. Do not run it again and do not merge.
2. `npx prisma migrate status` — it names the failed migration.
3. Read what was actually applied (the migration's SQL against the database's tables). A migration file usually
   applies completely or not at all, but that is not guaranteed — check, do not assume.
4. Fix it with a **new** forward migration, rehearsed on a copy (§6.1). `prisma migrate resolve` is only for telling Prisma what
   is already true in the database — never to hide a failure. *Not rehearsed on this project.*

**If the migration succeeded but damaged rows** (a wrong backfill): that is §6.

**If the release needs the old structure back** (the previous code cannot run on the new one): that migration broke the rule
above. Fix forward with new code or a new migration. A full restore (§6.3) is the last resort, because it throws away everything
customers did since the backup.

## 6. Getting data back

### 6.1 Restore a backup into a scratch database (the safe first step of everything)

*Verified: done on 7 Oct 2026, into a local PostgreSQL 17.*

1. Download the artifact of the chosen backup run from the backup repository.
2. Decrypt it with the passphrase (pass it through a file descriptor or a prompt — never on the command line, never in chat).
3. Create an **empty** database and restore: `pg_restore --no-owner --no-privileges --dbname=<scratch> <file>.dump`.
   The one message "schema public already exists" is harmless.
4. Delete the decrypted `.dump` file. The scratch database now holds **real customer data** — keep it on one machine, never
   deploy it, never share it.

### 6.2 Repair some rows (the usual case)

A wrong backfill, a mistaken delete, one damaged booking. *Not rehearsed on this project.*

1. Restore into a scratch database (§6.1).
2. Find exactly the rows that differ between the scratch copy and production. Write them down.
3. Write the repair as a script that touches only those rows, by id, inside one transaction. Run it on a second scratch copy
   first.
4. Take a fresh backup of production (§2), then the owner runs the script. Check the rows, then the live check (§7).

Payments, invoices and agreements are records of real money: repair them by adding a correcting record through the app wherever
the app allows it, not by editing rows.

### 6.3 Restore everything (last resort)

*Not rehearsed on this project. Do not attempt it for the first time during an incident — see §8.*

Everything written since the backup is lost: enquiries, quotations, bookings, payments, logins. Before starting, take one more
backup of the damaged database — it holds those newer rows, and they may be recoverable from it later.

The lower-risk shape, and the one to rehearse:

1. Create a **new** Supabase project. Restore the chosen backup into it (§6.1). Leave the damaged database untouched.
2. `npx prisma migrate status` against the new database must say it is up to date with the code on `main` (a backup taken
   before a later migration needs `migrate deploy` first).
3. Point Vercel's Production `DATABASE_URL` (pooled, port 6543) and `DIRECT_URL` (session, port 5432) at the new project and
   redeploy from GitHub.
4. Update the **other two places** the database address and password live: `.env.local` on the dev machine, and
   `BACKUP_DATABASE_URL` in the backup repository — or the nightly backup silently keeps backing up the old database.
5. Add the new project's reference to `PRODUCTION_PROJECT_REFS` in `lib/testing/dbGuard.ts`, so the database tests refuse to run
   against it.
6. Live check (§7), then a manual backup run to prove the backup now reads the new database.

What must **not** change during a restore:

- `BANK_ACCOUNT_ENCRYPTION_KEY` — vendors' bank account numbers are stored encrypted with it. A new key makes every stored
  number unreadable. Never regenerate it.
- `NEXTAUTH_SECRET` — changing it signs everybody out.

Known traps: Supabase's direct database host is IPv6-only, so use the pooler addresses; the database password can only be reset
in the Supabase dashboard; after a reset the pooler needs about ten seconds; and on 5 Oct 2026 a password reset took the live
site's database calls down for about 50 minutes because the three places above no longer matched.

## 7. The live check after any change

Read-only. No test bookings, enquiries or logins on production without the owner's say-so.

- [ ] The production deployment of the exact commit finished with status **success**.
- [ ] Home page, vendor login, admin login and `/api/health` answer.
- [ ] A signed-out request to a Vendor OS screen goes to the login page; a signed-out request to a Vendor OS API is refused.
- [ ] An unknown couple's link says it is no longer valid.
- [ ] Every table is the same before and after the release, apart from what the change meant to do and what real people did
      in between: `npm run db:snapshot take before` ahead of the release, `npm run db:snapshot take after` once it is live,
      then `npm run db:snapshot diff before after`. Read-only (one `BEGIN READ ONLY` transaction); it reads `.env.local`, which
      is **production**, and prints the database it is reading first. For a migration that adds columns, pass them to
      `--ignore-columns` on both. Snapshots stay on the machine (`.db-snapshots/`, git-ignored).
      *Verified: used for every release from 7 to 11 Oct 2026; in the repository since 11 Oct 2026.*
- [ ] The owner signs in and looks at the changed screen. Until then the release is "live, not seen".

## 8. What is still missing

1. **A full restore has never been rehearsed** (§6.3), nor a row repair (§6.2), nor Vercel's "Promote" (§4 Way 2). Until one
   rehearsal of §6.3 is done on a throwaway Supabase project and timed, the real time to recover from losing the database is
   unknown.
2. **No staging on the internet.** Rehearsals run on a local PostgreSQL on one dev machine. If that machine is lost, the
   rehearsal step of §2 has to be rebuilt.
3. ~~The before/after row-count check is not in the repository.~~ Added 11 Oct 2026: `scripts/db-snapshot.mjs` (§7). It still
   runs by hand, from one machine.
4. **Up to 24 hours of data can be lost** with a nightly backup and no point-in-time recovery. Running the backup by hand before
   risky work narrows that for planned changes only.
5. **Backups older than 90 days do not exist.**
6. **One person holds the passphrase and the dashboards.** There is no second person who could do §6 alone.
7. **Nothing alerts anyone** when the nightly backup fails or the site is down, beyond GitHub's own failure e-mail.
