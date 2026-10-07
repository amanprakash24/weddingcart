-- Person → Membership → Role → Permissions (7 Oct 2026), step 2 of 2. Additive only: no column or row is dropped or renamed.

-- 1. The login code belongs to the person, not to the vendor link.
ALTER TABLE "users" ADD COLUMN     "loginCodeHash" TEXT,
ADD COLUMN     "loginCodeSetAt" TIMESTAMP(3);

-- 2. A membership carries a job title and this person's own changes to the role's permissions.
ALTER TABLE "business_members" ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "grants" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "denies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "removedAt" TIMESTAMP(3);

-- 3. Existing vendor owners keep the code they already have: copy it to the person. (vendor_profiles keeps its columns, unread.)
UPDATE "users" u
SET "loginCodeHash" = vp."loginCodeHash", "loginCodeSetAt" = vp."loginCodeSetAt"
FROM "vendor_profiles" vp
WHERE vp."userId" = u."id" AND vp."loginCodeHash" IS NOT NULL AND u."loginCodeHash" IS NULL;

-- 4. Shaadi Shopping's own team become members of the Shaadi Shopping business: a SUPER_ADMIN as its OWNER; SALES / OPERATIONS
--    as MANAGERs who keep the access to money they have today (the founder can take it away per person from the Team screen).
--    Their portal roles (user_roles) and their email + password are not touched.
INSERT INTO "business_members" ("id", "businessId", "userId", "role", "grants", "denies", "createdAt")
SELECT gen_random_uuid()::text,
       'shaadi-shopping',
       t."userId",
       CASE WHEN t.is_owner THEN 'OWNER'::"BusinessRole" ELSE 'MANAGER'::"BusinessRole" END,
       CASE WHEN t.is_owner THEN ARRAY[]::TEXT[] ELSE ARRAY['view_financials', 'edit_financials']::TEXT[] END,
       ARRAY[]::TEXT[],
       CURRENT_TIMESTAMP
FROM (
  SELECT ur."userId", bool_or(ur."role" = 'SUPER_ADMIN') AS is_owner
  FROM "user_roles" ur
  WHERE ur."role" IN ('SUPER_ADMIN', 'SALES', 'OPERATIONS')
  GROUP BY ur."userId"
) t
WHERE EXISTS (SELECT 1 FROM "businesses" b WHERE b."id" = 'shaadi-shopping')
ON CONFLICT ("businessId", "userId") DO NOTHING;
