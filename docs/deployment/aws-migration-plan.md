# AWS Migration Plan — Vercel + Supabase → ECS Fargate + RDS

Status: **proposed** (2026-09-27). Nothing in AWS has been created yet.

## Why, and why this shape

On 2026-09-27 the Supabase production project (`axuvgctfggczewjbxwex`) turned out to be
deleted; the live site now runs on the former staging project (`xlrswgsadncosezfdgbm`).
Rather than rebuild the old setup, hosting and database move to AWS.

**Amplify Hosting was evaluated and rejected** for two independent reasons:
1. Amplify Hosting compute supports Next.js **up to 15**. This app is on 16.2 and depends
   on 16-only conventions (`proxy.ts` is the auth gate). No AWS timeline for 16
   ([issue #14600](https://github.com/aws-amplify/amplify-js/issues/14600)).
2. Amplify Hosting compute **cannot reach into a VPC**, so RDS would have to be publicly
   reachable ([issue #3362](https://github.com/aws-amplify/amplify-hosting/issues/3362)).
   This database holds customer phone numbers, payments and encrypted bank details.

Turso was also rejected: the code relies on Postgres-only features (scalar lists, row
locks in quotation/invoice/money code, `mode: 'insensitive'`, raw SQL).

**Chosen:** the app runs as a container on **ECS Fargate (Express Mode)**, exactly as
`next start` runs it — every Next 16 feature works — and talks to **RDS for PostgreSQL**
in private subnets. Region **ap-south-1 (Mumbai)**, closest to users in Bihar.

```
Users ──HTTPS──▶ ALB (ACM cert, created by Express Mode) ──▶ ECS Fargate task(s)
                                                              │ Next.js 16 standalone
                                                              ▼
                                         RDS PostgreSQL 17 (private subnets, no public access)
Secrets Manager ──(injected at task start)──▶ task      ECR ◀── GitHub Actions (OIDC)
```

Unchanged: Cloudinary (images), Razorpay, WhatsApp API, Google Analytics, the domain.

## Current state (verified 2026-09-27)

| Thing | Today |
|---|---|
| Hosting | Vercel `amanprakash24s-projects/weddingcart`, git-connected |
| Database | Supabase `xlrswgsadncosezfdgbm` (Postgres 17.6), 29 Prisma migrations |
| DNS | GoDaddy (`ns09/ns10.domaincontrol.com`); `www` → CNAME to Vercel |
| Vercel-only code | `@vercel/analytics` in `app/layout.tsx` (only one) |
| Runtime needs | `proxy.ts` (Node), ISR `revalidate = 3600` (6 pages), 8 `force-dynamic` routes, `next/image` remote patterns, webhooks: `/api/payments/webhook`, `/api/events/[id]/orders` |
| Container readiness | none yet — no `output: 'standalone'`, no Dockerfile, no CI workflow |
| AWS account | `018157124119` exists; the local CLI user is a Bedrock-only key — **not** to be used for infrastructure |

## Decisions needed before Phase 1

- [ ] **Who owns the AWS account** and creates an admin IAM Identity Center user for the work
      (not the root user, not the Bedrock key)
- [ ] **DNS**: move `shaadishopping.com` DNS to Route 53 (recommended — lets the bare domain
      point at the load balancer) **or** keep GoDaddy and forward the bare domain to `www`
- [ ] **Availability**: 1 task (cheapest, ~1 min outage during a bad deploy/restart) or
      2 tasks across two zones (+~$16/month)
- [ ] **Monthly budget** ceiling for an AWS Budgets alarm (suggest $80)

## Phases

Each phase ends in something a person can check by using the site, not just "infra exists".

### Phase 1 — Containerize the app (repo only, no AWS)
- `next.config.ts`: `output: 'standalone'`
- `Dockerfile` (multi-stage: install → `prisma generate` + `next build` → slim runtime on
  Node 24 with `.next/standalone`, `.next/static`, `public`); `.dockerignore` that excludes
  every `.env*` file
- `NEXT_PUBLIC_*` values are **build-time** — pass them as build args, never secrets
- Add `GET /api/health` for the load balancer health check — **no DB call**, so a brief
  database blip can't make ECS replace healthy tasks
- Replace `@vercel/analytics` (GA is already wired) and remove the dependency
- `mongodb`/`mongoose` stay for now: only the retired one-off `scripts/*.mjs` import them,
  and they're excluded from the image — remove together with those scripts later
- **Done when:** `docker build` then `docker run -p 3001:3000 --env-file .env.local` serves
  the site locally, `/admin` login works, `/api/health` returns 200, `bun test` + `tsc` pass

**Status (2026-09-27): code done, verified without Docker** (Docker isn't installed on the
dev machine): a Docker-equivalent context with no `.env` files installs from `bun.lock` and
builds with only `DATABASE_URL`; the standalone server passes health/homepage/API/page/
sitemap/image checks and redirects `/admin/*` to login. Still to verify: a real `docker build`
(locally or in the Phase 3 pipeline) and an admin login against the container.

### Phase 2 — AWS foundation + first deploy on the AWS URL
- AWS Budgets alarm; CloudTrail on (default)
- **RDS for PostgreSQL 17**, `db.t4g.micro`, 20 GB gp3, single-AZ, private subnets,
  *public access off*, **deletion protection on**, **automated backups 7 days**, encryption on.
  (The Supabase prod project was lost to a deletion — these two settings are non-negotiable.)
- Security groups: RDS accepts 5432 **only** from the ECS task security group
- **Secrets Manager**: `DATABASE_URL`, `NEXTAUTH_SECRET` (new value), `RAZORPAY_*`,
  `WHATSAPP_*`, `CLOUDINARY_*`, `BANK_ACCOUNT_ENCRYPTION_KEY` (**same value as today** —
  otherwise stored bank details can't be decrypted)
- ECR repository (scan on push, keep last 20 images)
- **ECS Express Mode** service: Fargate 0.5 vCPU / 1 GB, health check `/api/health`,
  secrets injected via the task definition `secrets` field
- Copy data: `pg_dump --schema=public` from Supabase → `pg_restore` into RDS (via a one-off
  ECS task or a temporary bastion; RDS is never opened to the internet)
- **Done when:** the Express Mode URL serves the site with real data; the golden path works
  there: `/plan` submit → CRM inbox → lead workspace → vendor selection → quote

### Phase 3 — Deploy pipeline
- GitHub Actions with **OIDC** (no long-lived AWS keys in GitHub): on push to `main` →
  test → build image → push to ECR → run `prisma migrate deploy` as a one-off ECS task →
  update the service; ECS deployment circuit breaker with auto-rollback on
- PR builds run `tsc` + `bun test` only (no preview environments at first — can add later)
- **Done when:** a trivial PR merged to `main` reaches the AWS URL with no manual steps, and
  a deliberately broken health check rolls back automatically

### Phase 4 — Rehearsal
- Fresh dump/restore, timed (sets the real cutover window)
- Run `bun run test:db` against a **throwaway copy** of the RDS database, never the real one
- Razorpay test-mode payment + webhook against the AWS URL
- Load-check the ISR pages and image optimization
- **Done when:** the timed restore fits the planned window and every check above passes

### Phase 5 — Cutover (planned low-traffic window, e.g. 02:00 IST)
1. Lower DNS TTL to 300 s **48 h before**
2. Announce/accept a short write freeze (CRM staff off; forms may fail for ~15–30 min)
3. Final `pg_dump` from Supabase → `pg_restore` into RDS; compare row counts per table
4. Attach custom domain + ACM certificate to the service; point `www` at the load balancer;
   bare domain per the DNS decision
5. Update the Razorpay webhook URL only if it changes (it shouldn't — same domain)
6. Verify: homepage, `/api/categories`, `/api/vendors`, `/admin` login, a test consultation,
   sitemap, a vendor page image
- **Done when:** the site works on `www.shaadishopping.com` from AWS and new writes land in RDS

**Rollback:** until real users write to RDS, point DNS back to Vercel (still deployed and still
on Supabase). After that it's a one-way door — same rule as `rollback-checklist.md` — and the
fix is forward.

### Phase 6 — Decommission (after 2 weeks stable)
- Remove the Vercel project's production domain, then the project
- Final `pg_dump` of Supabase archived to S3, then pause/delete the Supabase project
- Rotate every secret that was ever in Vercel/Supabase (several were exposed in chat on
  2026-09-27)
- Update `.env.example`, `docs/deployment/*`, and the README

## Rough monthly cost (ap-south-1, estimates — confirm with the AWS Pricing Calculator)

| Item | ~USD/month |
|---|---|
| Fargate 0.5 vCPU / 1 GB, 1 task 24×7 | 15–18 |
| Application Load Balancer | 18–22 |
| RDS `db.t4g.micro` + 20 GB gp3 + backups | 16–20 |
| Secrets Manager (~10 secrets), ECR, CloudWatch logs | 6–10 |
| **Total** | **~55–70** (2 tasks: +~16) |

No NAT gateway (tasks run in public subnets with a restrictive security group; RDS stays
private) — that alone saves ~$35/month.

## Known caveats
- **ISR cache is per task.** With 2 tasks, two copies of a page can differ for up to an hour
  (`revalidate = 3600`). Acceptable today; a shared cache handler can come later.
- `NEXT_PUBLIC_*` changes need a rebuild, not just a restart.
- Rotated secrets reach running tasks only after a new deployment.
- Express Mode creates the load balancer, scaling and alarms for you; customizing beyond that
  means managing those resources directly
  ([docs](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-advanced-customization.html)).

## References
- [Amplify: Next.js support](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html)
- [ECS Express Mode overview](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html)
- [Resources created by Express Mode](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-work.html)
- [Express Mode best practices](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-best-practices.html)
- Existing: `release-readiness-checklist.md`, `rollback-checklist.md`
