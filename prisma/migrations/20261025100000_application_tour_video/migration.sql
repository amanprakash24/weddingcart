-- One tour video on a vendor registration (25 Oct 2026). Additive: existing applications get "" (no video).
ALTER TABLE "vendor_applications" ADD COLUMN "tourVideo" TEXT NOT NULL DEFAULT '';
