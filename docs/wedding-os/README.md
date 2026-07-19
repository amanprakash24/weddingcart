# Wedding OS — Functional Design

Part 3 of the product sequence (Vision & PRD → Architecture & Database → **Functional
Design** → implementation). This is where every Wedding OS feature gets specified
before it's coded — the goal is that by the time the Postgres migration
(`docs/postgres-migration-plan.md` and friends) is done, there's a complete,
version-controlled blueprint for what gets built next, not a blank slate.

None of this depends on Milestone 3 finishing. It also isn't blocked on it.

## Documents

- **`01-command-center.md`** — Founder, Sales, Operations, and Vendor dashboards.
  First doc in this set.
- `02-crm.md` — lead lifecycle, follow-up engine, sales pipeline (planned, not started)
- `03-wedding-workspace.md` — per-wedding view: timeline, checklist, budget, documents (planned)
- `04-vendor-os.md` — availability, packages, calendar, earnings (planned)
- `05-customer-portal.md` (planned)
- `06-finance.md` — payments, GST, commission, profit (planned)
- `07-ai-assistant.md` — follow-up nudges, vendor recommendations, summaries (planned)

## Relationship to the Postgres migration

These specs will surface data-model requirements (new entities, new fields) that
don't exist in `prisma/schema.prisma` yet — that schema was deliberately scoped to a
1:1 port of the current Mongo collections (Phase A), with the `Wedding` entity and
everything downstream of it explicitly deferred to "Phase B." Each doc in this set
should end with a **"Data model gaps"** section listing exactly what Phase B needs to
add, so the eventual schema migration is driven by real functional requirements
instead of guessing ahead of time.
