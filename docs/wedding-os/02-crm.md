# CRM — Functional Design

Lead lifecycle, follow-up engine, sales pipeline. This is the module that directly
generalizes the founder's stated pain point (only person handling follow-ups,
nothing tracked systematically) into a real system — everything here should be
judged against "would this have prevented a lead from going cold."

## 1. Purpose

Get every inbound lead from first contact to a booked Wedding (or a recorded loss),
with nothing falling through the cracks and every follow-up traceable to a person
and a time. Used by Sales day-to-day, Founder for oversight (this is where the
Command Center's Sales Dashboard widgets, §4 of `01-command-center.md`, get their
data).

## 2. Core design decision: three capture entities, one pipeline

Today there are **three separate entry points** into the funnel, each already a
real Prisma model from Phase A:

- **`Lead`** — phone-only popup capture (lowest intent/detail)
- **`Enquiry`** — vendor-specific contact form, tied to one `Vendor`
- **`Consultation`** — the full planning-wizard submission (highest detail: budget,
  guest count, services wanted, cart items)

**Decision: keep these three as distinct capture entities (don't merge them into one
table — they genuinely capture different data shapes), but every one of them feeds
the same pipeline.** A `Lead`/`Enquiry`/`Consultation` is qualified and worked exactly
like the other two; the only difference is how much information it started with.
When a deal is won, **it converts into a `Wedding`** (the aggregate root already
established as the core architectural principle — "a lead becomes a wedding") — at
that point the CRM's job on that record is done and `03-wedding-workspace.md` (not
yet written) takes over execution.

This means the CRM needs a **unified pipeline view** that queries across all three
tables (a "Lead Inbox," §6), even though the underlying data stays in three tables —
consistent with the Milestone 2 repository pattern (`services/lead.service.ts` /
`enquiry.service.ts` / `consultation.service.ts` would each expose the standard
interface, and a higher-level `pipelineService` composes across them, same
Route Handler → Service → Repository → Prisma layering as everything else).

## 3. Lead lifecycle

**Current state (Phase A, ported from Mongo):** each entity has its own narrow
status enum — `EnquiryStatus`/`ConsultationStatus` are `NEW → CONTACTED → CLOSED`,
`Lead` has no status field at all. None of these represent an actual sales pipeline;
they were sufficient for the old admin's list-and-mark-contacted workflow, not for
CRM-grade stage tracking.

**Proposed pipeline stages** (a new shared concept, not per-entity status):

```
NEW → CONTACTED → QUALIFIED → SITE_VISIT_SCHEDULED → QUOTATION_SENT
    → NEGOTIATION → WON (converts to Wedding) | LOST (with reason)
```

- **NEW** — captured, not yet touched
- **CONTACTED** — first outreach made (call/WhatsApp/email logged)
- **QUALIFIED** — real wedding, real timeline, real budget confirmed (vs. a tire-kicker)
- **SITE_VISIT_SCHEDULED** — a visit is booked (relevant mainly for venue-led enquiries)
- **QUOTATION_SENT** — a `Quotation` has gone out (entity doesn't exist yet — see gaps)
- **NEGOTIATION** — active back-and-forth on price/package
- **WON** — converts to a `Wedding` record; this specific `Lead`/`Enquiry`/`Consultation`
  row is marked converted and linked via the `customerId`/`legacyMongoId`-style
  reference already reserved on these tables from Phase A
- **LOST** — needs an explicit reason code (budget, chose competitor, date conflict,
  went cold, etc.) — today's enums have no losing terminal state at all, everything
  either stays open or silently goes stale

**Lead scoring/prioritization** (not a hard requirement for v1, but worth designing
for): each lead should carry an implicit priority signal — days until the wedding
date, budget size, responsiveness so far — the same signal the original CRM vision's
AI Assistant example was built around ("wedding date is in 3 months, high probability
of booking, recommend calling today between 6–8 PM"). Doesn't need to be AI-powered
initially; a simple rules-based score (days-to-wedding × budget tier) is a fine v1,
with `07-ai-assistant.md` upgrading it later.

## 4. Follow-up engine

This is the direct fix for the founder's stated problem.

**Follow-up types:** Call, WhatsApp, Email, Site Visit. **WhatsApp send capability
already exists** (`lib/whatsapp.ts`, currently used for OTP delivery and
lead/consultation notifications) — the follow-up engine should reuse this
integration, not build a second one.

**Core behaviors:**
- Every lead, on entering `CONTACTED` or later, must have a next-follow-up date/time
  scheduled — the system should not allow a lead to sit with no scheduled next action
- Overdue follow-ups surface as an alert (already specified as a Command Center
  alert type, §5 of `01-command-center.md`) and in the Sales Dashboard's
  "Follow-ups Due Today" widget
- SLA rule (configurable, not hardcoded): a NEW lead must receive first contact
  within N hours — flag if breached
- Every follow-up attempt (not just the scheduling of the next one) gets logged:
  who, when, channel, outcome/notes — this log is what makes a lead's history
  auditable instead of living in someone's head

## 5. Sales pipeline (Kanban view)

A board with one column per stage (§3), cards representing individual
`Lead`/`Enquiry`/`Consultation` records (visually indistinguishable by source once
in the pipeline — the source shows as a badge, not a separate board). Cards show:
name, phone, city, budget (if known), days since last contact, assigned rep,
priority signal (§3).

**Conversion funnel reporting:** stage-to-stage drop-off (e.g. 100 NEW → 60
CONTACTED → 40 QUALIFIED → ... → 12 WON), source performance (which of Lead/Enquiry/
Consultation converts best), and per-rep performance — all of which power the
Founder Dashboard's Conversion Rate and Team Performance widgets and the Sales
Dashboard's Personal Conversion Rate widget from `01-command-center.md`.

## 6. Screens / widgets

| Screen | Purpose | Data source | Permissions |
|---|---|---|---|
| Lead Inbox | Unified list across Lead/Enquiry/Consultation, filterable by stage/source/city/assignee | All three tables, composed in a `pipelineService` | Sales (assigned to them by default, can view all), Founder (all) |
| Lead Detail | Single lead's full history — original capture data, every follow-up logged, stage history, convert-to-Wedding action | Same three tables + the new FollowUp/Task log | Sales (assigned), Founder (all) |
| Follow-up Queue | Today's due + overdue follow-ups, one-tap log-and-reschedule | FollowUp/Task entity (gap) | Sales (own), Founder (all, view) |
| Pipeline Board | Kanban view, drag-to-advance-stage | Same three tables + PipelineStage | Sales (own + reassign), Founder (all) |
| Reports | Funnel, source performance, rep performance, SLA compliance | Aggregated from all of the above | Founder (full), Sales (own only) |

## 7. Data model gaps — RE-VERIFIED against the real Phase B schema (2026-07-21)

This section originally listed gaps against Phase A. **All of the schema-level
gaps are now closed** — verified directly against `prisma/schema.prisma`, not
assumed:

| Concept | Status | Detail |
|---|---|---|
| `PipelineStage` | ✅ Built | Real enum (`NEW`...`WON`/`LOST`), a field on `Lead`/`Enquiry`/`Consultation` — resolved as an enum field, not a separate lookup table |
| `Task` (unified — replaces the earlier separate "FollowUp" language) | ✅ Built | `context`, `status`, `priority`, `dueAt`, `completedAt`, `assignedToId`. **One nuance the original "FollowUp" wording implied that isn't quite how it landed**: the follow-up *channel* (call/WhatsApp/email/site visit) isn't a field on `Task` itself — it's recorded via a linked `ActivityLog` entry (`ActivityType.CALL`/`WHATSAPP`/`EMAIL`/etc.) when the task is actually worked. `Task` = what's due; `ActivityLog` = what happened. Not a conflict, just worth knowing before building the Follow-up Queue screen (§6) so it's built against two tables, not one |
| `assignedToId` on `Lead`/`Enquiry`/`Consultation` | ✅ Built | Real field (named `assignedToId`, not `assignedToUserId`) |
| `Quotation` | ✅ Built | Real model, `QuotationStatus` enum (`DRAFT`/`SENT`/`ACCEPTED`/`REJECTED`/`EXPIRED`) |
| Explicit `LOST` state + `lostReason` | ✅ Built | Both real |
| Lead priority score | Still open, not schema-blocking | Correctly left as computed (no column) per this doc's own original call — no change needed |
| Follow-up SLA config | Still open, not schema-blocking | Where "first contact within N hours" lives (settings table vs. hardcoded) — genuinely undecided, flag for whoever implements the Follow-up engine |
| **AI-prep fields (`summary`/`next_action`/`priority`/`sentiment`) per lead** | **Decided 2026-07-21 — NOT nullable columns on Lead/Enquiry/Consultation** | See "AI insight storage" below |

### AI insight storage: decided as a separate `LeadInsight` entity, not columns on Lead (2026-07-21)

Explicitly rejected adding 4 nullable columns (`summary`, `next_action`, `priority`, `sentiment`) directly to `Lead`/`Enquiry`/`Consultation`. Reasoning: AI output is **derived**, not source-of-truth — it changes over time (summaries get regenerated, models get swapped, humans override AI output), and a flat column silently overwrites that history on every regeneration.

**Decision: a new `LeadInsight` entity** (not yet added to `prisma/schema.prisma` — this is a documented decision, not implemented; deferred past Sprint 5.1, revisit no later than Sprint 5.2 since Lead Workspace is where these would be shown):

```
LeadInsight
  id
  leadId / enquiryId / consultationId   (exactly one set, same pattern as Quotation)
  generatedBy   (AI | HUMAN)
  summary
  nextAction
  sentiment
  confidence
  createdAt
  updatedAt
```

Keeping this separate from the capture entities gives versioning (multiple insights over time, not one overwritten field), auditability (human vs. AI provenance via `generatedBy`), room for multiple AI models later, and manual overrides — without touching `Lead`/`Enquiry`/`Consultation` at all. Also consistent with "workflows first, AI second" (`07-ai-assistant.md`): this entity can be designed now and populated manually (`generatedBy: HUMAN`) before any AI integration exists.

## 8. Relationship to other modules

- Feeds the **Founder Dashboard** (New Leads, Conversion Rate, Team Performance)
  and **Sales Dashboard** (New Leads Assigned, Follow-ups Due Today, Quotations
  Sent, Deals Won/Lost, Personal Conversion Rate) widgets from
  `01-command-center.md` directly — this doc is where those widgets' data actually
  gets created.
- A `WON` lead converts into a `Wedding`, handed off to `03-wedding-workspace.md`
  (not yet written).
- `07-ai-assistant.md` (not yet written) is where the lead priority score and
  follow-up nudges eventually get AI-upgraded — this doc specifies the rules-based
  v1 they'd replace.

## 9. Future enhancements

- AI-generated follow-up message drafts (WhatsApp/email), not just nudges to follow up
- Automatic lead-to-rep assignment (round robin / city-based / workload-based)
- Predictive win-probability scoring replacing the simple v1 priority signal
