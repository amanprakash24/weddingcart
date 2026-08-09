# Performance Baseline — Pre-Migration (MongoDB)

Captured 2026-07-19 against the live production site (`https://www.shaadishopping.com`)
via read-only `curl` GET requests (3 runs each, network-variable — treat as directional,
not lab-precise). **Re-capture the same requests against the Postgres-backed app
post-migration and compare directly** — that comparison is the actual deliverable,
not these numbers in isolation.

| Page/endpoint | Run 1 | Run 2 | Run 3 | Notes |
|---|---|---|---|---|
| Homepage `/` | 0.310s | 0.286s | 0.306s | Consistently fast, ISR/CDN-cached |
| Vendor detail `/vendors/venue-1` | 2.081s | 1.160s | 1.076s | First run likely a cold cache; steady-state ~1.1s |
| Blog list `/blog` | 1.471s | 2.095s | 1.268s | |
| Blog post `/blog/ashiyana-resort-banquet-hall-digha-patna` | 1.074s | 1.053s | 1.487s | |
| Vendor search `/api/vendors?city=Patna&limit=20` | 4.498s | 0.814s | 2.447s | **High variance — flagged below** |

## Finding worth carrying into the post-migration comparison

The vendor search endpoint's variance (0.8s–4.5s across 3 back-to-back requests) is
consistent with a concern already flagged in `docs/postgres-migration-plan.md` §2:
the current Mongo search uses `$regex` matching (`name`/`city`/`description`), not an
indexed text search — a full collection scan under the hood, not something a proper
index would fix by itself. **This is exactly the kind of number the Postgres
migration should improve** if the new schema's `Vendor(categoryId, city, rating)`
index is doing its job, though note that index doesn't cover the `search` free-text
path — the migration plan already flags the lack of a `pg_trgm`/full-text index as
an open gap. Worth specifically re-measuring this endpoint post-migration rather than
assuming the relational move alone fixes it.

## What's NOT measured here, and why

**Booking creation (`POST /api/bookings`)** is intentionally not measured against
production — exercising it would create a real (fake) booking record in live
customer-facing data, which isn't an acceptable cost for a benchmark. This needs to
be measured against a staging environment with disposable data once one exists
(Milestone 3's rehearsal-run environment is the natural place), not production.

## How to re-run this baseline

```bash
for i in 1 2 3; do curl -s -o /dev/null -w "run $i: total=%{time_total}s ttfb=%{time_starttransfer}s\n" <url>; done
```

Run against the same 5 URLs above, post-migration, and place the results side by side
in this file (or a dated copy) before signing off on Milestone 5/6.
