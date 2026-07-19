# Wedding OS — Functional Design

Part 3 of the product sequence (Vision & PRD → Architecture & Database → **Functional
Design** → implementation). This is where every Wedding OS feature gets specified
before it's coded — the goal is that by the time the Postgres migration
(`docs/postgres-migration-plan.md` and friends) is done, there's a complete,
version-controlled blueprint for what gets built next, not a blank slate.

None of this depends on Milestone 3 finishing. It also isn't blocked on it.

## Documents

- **`01-command-center.md`** — Founder, Sales, Operations, and Vendor dashboards.
- **`02-crm.md`** — lead lifecycle, follow-up engine, sales pipeline.
- **`03-wedding-workspace.md`** — per-wedding view: timeline, events, vendors, budget, documents, tasks, communication, health score.
- **`04-vendor-os.md`** — profile self-service, availability/calendar, booking confirmation, packages, earnings, reviews, Vendor Score.
- `05-customer-portal.md` (planned — deliberately written last, after AI, so it's designed with the AI surface already known)
- **`06-finance.md`** — payments (Razorpay), vendor payouts, commission, GST data requirements, profit reporting.
- **`07-ai-assistant.md`** — AI mapped across every role (Founder/Sales/Operations/Vendor/Customer), 3-level framework (Assistant/Copilot/Autonomous — v1 ships Assistant+Copilot only), closes the AI-upgrade loop left open by 02/03/04.

## Relationship to the Postgres migration

These specs will surface data-model requirements (new entities, new fields) that
don't exist in `prisma/schema.prisma` yet — that schema was deliberately scoped to a
1:1 port of the current Mongo collections (Phase A), with the `Wedding` entity and
everything downstream of it explicitly deferred to "Phase B." Each doc in this set
should end with a **"Data model gaps"** section listing exactly what Phase B needs to
add, so the eventual schema migration is driven by real functional requirements
instead of guessing ahead of time.
