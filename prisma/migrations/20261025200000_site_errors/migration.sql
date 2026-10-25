-- Site errors (25 Oct 2026): errors people hit on the live site, grouped, for /admin/errors. Additive: a new table only.
CREATE TYPE "SiteErrorSource" AS ENUM ('SERVER', 'BROWSER');

CREATE TABLE "site_errors" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "source" "SiteErrorSource" NOT NULL,
    "message" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "detail" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastBrowser" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "site_errors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "site_errors_fingerprint_key" ON "site_errors"("fingerprint");

CREATE INDEX "site_errors_resolvedAt_lastSeenAt_idx" ON "site_errors"("resolvedAt", "lastSeenAt");
