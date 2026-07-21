# AI Assistant — Functional Design

Not a chatbot bolted onto the side of the product — AI embedded throughout every
module already specified. This doc exists because five modules deep
(`01`–`04`, `06`) is the point where "where should AI help" can be answered
concretely instead of speculatively, and because three separate docs already
promised an AI upgrade path without detailing it (see §4 — closing those loops is
this doc's first job).

## 1. Three levels

**Level 1 — Assistant**: answers questions, generates text, summarizes
information. No action taken, nothing sent without a human choosing to send it.

**Level 2 — Copilot**: recommends actions, drafts follow-ups, flags issues,
prioritizes work. Still requires a human to approve/send/act — the AI prepares,
the person decides.

**Level 3 — Autonomous**: sends reminders, creates tasks, schedules follow-ups,
suggests vendor matches — **without** a human in the loop for each instance, only
within pre-approved rules.

**v1 scope: Assistant + Copilot only.** Level 3 is real future work, not this pass
— anything that sends a message or takes an action on a customer's or vendor's
behalf needs a trust foundation this platform doesn't have yet (see §6 Guardrails).
Every Level 3 idea below is listed as a future enhancement, not a v1 deliverable.

**Sequencing, confirmed explicitly (2026-07-21): AI comes after clean workflows and
structured data, not alongside them.** Milestone 5 (CRM) and beyond should focus on
capturing structured data (pipeline stages, timelines, `ActivityLog` entries) and
building solid workflows first — AI becomes dramatically more valuable once it has
high-quality history to work with, rather than being asked to compensate for thin
or messy data. This doesn't change the framework above, it reinforces why v1 is
already scoped to Assistant + Copilot: it's the same underlying judgment, stated
as an explicit sequencing decision rather than left implicit.

## 2. AI by role

For each: feature, level, data source (existing or planned entity from earlier docs).

### Founder
| Feature | Level | Data source |
|---|---|---|
| Daily business summary | 1 | All Founder Dashboard widgets (`01-command-center.md` §4.1) — narrated, not new data |
| Revenue forecast | 2 | Historical revenue (`06-finance.md`) + open pipeline value (`02-crm.md`'s pipeline) |
| Low-performing categories | 1 | Founder Dashboard's City-wise Performance widget, re-cut by category |
| Lead conversion insights | 1 | CRM funnel reporting (`02-crm.md` §5) |

### Sales
| Feature | Level | Data source |
|---|---|---|
| Draft WhatsApp follow-ups | 2 | Generates message content; sending still goes through the existing `lib/whatsapp.ts` integration named in `02-crm.md` — AI drafts, doesn't add a new send path |
| Prioritize today's leads | 2 | **This is the AI upgrade for `02-crm.md`'s rules-based lead priority score** — see §4 |
| Summarize conversations | 1 | The unified `ActivityLog`/`Communication` timeline from `03-wedding-workspace.md` §9 |
| Suggest next actions | 2 | Pipeline stage + follow-up history |

### Operations
| Feature | Level | Data source |
|---|---|---|
| Detect schedule conflicts | 1 | **Clarification, not a redesign:** the actual conflict check is already deterministic (`04-vendor-os.md` §3's `VendorAvailability` logic) — AI's role here is explaining/prioritizing *which* conflicts matter most and surfacing *likely* future conflicts before they're booked, not replacing the underlying check |
| Highlight overdue tasks | 1 | Task Board (`03-wedding-workspace.md` §8) — narrated/prioritized, data already exists |
| Identify vendor risks | 2 | **This is the AI upgrade for `04-vendor-os.md`'s rules-based Vendor Score** — see §4 |

### Vendor
| Feature | Level | Data source |
|---|---|---|
| Improve package descriptions | 1 | Rewrites `VendorPackage.description` (already exists, Milestone 2 repository) |
| Generate quotation text | 1 | Drafts against the `Quotation` entity named in `02-crm.md` §7 |
| Suggest pricing updates | 2 | Compares against category/city price ranges (already real data — `Vendor.priceMin`/`priceMax` across a category) |
| Respond to enquiries faster | 2 | Drafts a reply to an `Enquiry` — human vendor still sends |

### Customer *(forward-looking — full detail belongs in `05-customer-portal.md`, listed here so that doc gets designed knowing what AI surface it needs to expose)*
| Feature | Level | Data source |
|---|---|---|
| Recommend vendors | 2 | Vendor Score (`04-vendor-os.md` §7) |
| Build a wedding timeline | 1 | Suggests a `WeddingEvent`/Timeline structure (`03-wedding-workspace.md` §3–4) as a starting point, editable |
| Estimate budgets | 1 | **Real data already exists for this**: `components/WeddingDashboardClient.tsx`'s `EST_RANGES` per category is a live, already-built estimate table — v1 AI budget estimation can start from formalizing that existing logic rather than inventing new pricing data |
| Answer planning questions | 1 | General Q&A — could reuse the GEO/`llms.txt` content already built for search-engine answer surfaces as a starting knowledge base |

## 3. Guardrails

Given this touches customer- and vendor-facing communication and (eventually)
money-adjacent decisions, v1 constraints:
- **No AI-sent message reaches a customer or vendor without a human approving it**
  (Level 2, not Level 3) — matches the explicit caution already applied to
  Finance (`06-finance.md`) around anything money-adjacent.
- **No autonomous financial actions** — AI never initiates a payout, refund, or
  discount on its own, full stop, regardless of level. This is a hard rule, not a
  configurable one.
- Every AI-drafted output (message, summary, recommendation) should be logged as
  such (see §5 gap) — if a customer later disputes a message's content, there
  needs to be a record of what was AI-drafted vs. human-written, and who approved
  sending it.
- Level 3 (§1), when it eventually ships, must be **configurable per action type**,
  not an all-or-nothing switch — e.g. auto-sending a routine payment reminder might
  earn trust before auto-scheduling a follow-up call would.

## 4. Closing the loop: AI upgrade targets from earlier docs

Three prior docs explicitly deferred a rules-based v1 to "AI upgrade later" without
detail. This is that detail:

| Rules-based v1 | Specified in | AI upgrade (this doc) |
|---|---|---|
| Lead priority score (days-to-wedding × budget tier) | `02-crm.md` §3 | Sales' "Prioritize today's leads" (§2) — same inputs, plus response-history and message-sentiment signals a fixed formula can't weigh |
| Wedding Health Score (🟢/🟡/🔴) | `03-wedding-workspace.md` §10 | Not directly listed in §2 above — **flag as a gap**: no role's AI feature list explicitly targets this yet. Natural fit would be Operations' "Identify vendor risks" extended to wedding-level risk, or its own explanation layer ("why is this 🟡") already named as a future enhancement in `03-wedding-workspace.md` |
| Vendor Score | `04-vendor-os.md` §7 | Operations' "Identify vendor risks" and Customer's "Recommend vendors" (§2) both consume it |

## 5. Data model gaps

| Concept | Detail |
|---|---|
| AI-generation flag on `ActivityLog`/`Communication` | Every AI-drafted message needs to be marked as such, plus who approved sending it — required by the Guardrails audit-trail rule (§3), not optional |
| Approval queue for Level 2 outputs | Drafts (WhatsApp follow-ups, quotation text, enquiry replies) need a pending-approval state before send — could reuse the same shape as the profile-change approval queue named in `04-vendor-os.md` §2 rather than inventing a third approval mechanism |
| Wedding Health Score AI target | Per §4 — undecided which role's feature list owns this, flagged not resolved |

## 6. Relationship to other modules

Touches all five modules specified so far — `01` (Founder/Operations summaries),
`02` (lead prioritization, follow-up drafting), `03` (communication summaries,
Wedding Health Score explanation), `04` (Vendor Score upgrade, vendor-side
copilot features), `06` (revenue forecasting). `05-customer-portal.md` (next) is
the first doc written *with* this one's Customer row already in hand, rather than
retrofitted afterward — the ordering reasoning given for building this before `05`.

## 7. Future enhancements (Level 3, explicitly deferred)

- Auto-sent routine reminders (payment due, follow-up overdue) within approved rules
- Auto-created tasks from detected signals (e.g. a vendor confirmation overdue by
  N days auto-creates an Operations task)
- Auto-scheduled follow-ups based on lead behavior
- AI-suggested vendor matches surfaced proactively, not just on request

Each of these should roll out individually, configurable, once the Level 1/2
features above have run long enough to establish trust in the underlying data and
recommendations — not as a bundled "turn on autonomy" switch.
