-- "Choose your own code" reminder on My Wedding (29 Oct 2026). Additive only: one new column, false for every existing row.
-- true = the person's login code was given to them (by Shaadi Shopping or a venue) and they have not chosen their own yet.
ALTER TABLE "users" ADD COLUMN "loginCodeGiven" BOOLEAN NOT NULL DEFAULT false;

-- Couples who already have a code were all given it (couples can only have chosen their own since 28 Oct 2026): couple-only
-- logins (only the CUSTOMER role, no business) with a code get the reminder too.
UPDATE "users" u SET "loginCodeGiven" = true
WHERE u."loginCodeHash" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "user_roles" r WHERE r."userId" = u."id" AND r."role" = 'CUSTOMER')
  AND NOT EXISTS (SELECT 1 FROM "user_roles" r WHERE r."userId" = u."id" AND r."role" <> 'CUSTOMER')
  AND NOT EXISTS (SELECT 1 FROM "business_members" m WHERE m."userId" = u."id");
