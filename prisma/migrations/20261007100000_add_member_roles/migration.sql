-- Person → Membership → Role → Permissions (7 Oct 2026), step 1 of 2: two more roles for a member of a business.
-- Its own migration because a new enum value cannot be used in the transaction that adds it. Additive only.
ALTER TYPE "BusinessRole" ADD VALUE 'MANAGER';
ALTER TYPE "BusinessRole" ADD VALUE 'EMPLOYEE';
