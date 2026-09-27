# syntax=docker/dockerfile:1.7
# Production image for ECS Fargate — see docs/deployment/aws-migration-plan.md (Phase 1).
#
# Build (DATABASE_URL is needed at build time: vendor/venue pages are prerendered from the DB).
# It is passed as a BuildKit secret so it never lands in an image layer:
#   docker build --secret id=database_url,env=DATABASE_URL \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://www.shaadishopping.com -t shaadishopping .
# Run:
#   docker run -p 3000:3000 --env-file <runtime env file> shaadishopping

ARG NODE_VERSION=24
ARG BUN_VERSION=1.3

FROM oven/bun:${BUN_VERSION} AS bun

FROM node:${NODE_VERSION}-slim AS base
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- deps: install from bun.lock (the lockfile kept in sync with package.json) ----
FROM base AS deps
COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma
# postinstall runs `prisma generate`; prisma.config.ts resolves DIRECT_URL on load but
# generate never connects, so a placeholder is enough here.
ENV DIRECT_URL=postgresql://build:build@localhost:5432/build
RUN bun install --frozen-lockfile

# ---- build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/generated ./generated
COPY . .
# Public, build-time values (inlined into the client bundle) — not secrets.
ARG NEXT_PUBLIC_SITE_URL=https://www.shaadishopping.com
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID
ARG NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID \
    NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID=$NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID \
    NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL=$NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL \
    DIRECT_URL=postgresql://build:build@localhost:5432/build
RUN --mount=type=secret,id=database_url,required=true \
    DATABASE_URL="$(cat /run/secrets/database_url)" bun run build

# ---- runtime: standalone server only, no node_modules install ----
FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
