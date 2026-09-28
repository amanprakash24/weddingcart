-- Logout-everywhere: token version per user (see lib/auth/sessionVersion.ts). Additive; existing rows get 0.
ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
