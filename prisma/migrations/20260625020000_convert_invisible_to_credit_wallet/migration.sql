ALTER TABLE "InvisibleSubscription"
ADD COLUMN IF NOT EXISTS "creditsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "purchaseDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3);

UPDATE "InvisibleSubscription"
SET
  "creditsUsed" = GREATEST(0, "totalCredits" - "remainingCredits"),
  "purchaseDate" = COALESCE("purchaseDate", "startedAt", "createdAt"),
  "expiresAt" = NULL
WHERE "purchaseDate" IS NULL OR "expiresAt" IS NOT NULL;

UPDATE "InvisibleSubscription"
SET "status" = CASE
  WHEN "remainingCredits" > 0 THEN 'active'
  ELSE 'exhausted'
END
WHERE "status" IN ('active', 'expired');
