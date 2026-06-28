ALTER TABLE "InterviewSession"
ADD COLUMN "settledAt" TIMESTAMP(3),
ADD COLUMN "settlementElapsedSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "settlementConsumedMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "settlementConsumedCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "settlementSubscriptionId" TEXT;

UPDATE "InterviewSession"
SET
  "settledAt" = COALESCE("endedAt", "updatedAt"),
  "settlementElapsedSeconds" = "interviewDurationSeconds",
  "settlementConsumedMinutes" = CASE
    WHEN "interviewDurationSeconds" > 0 THEN CEIL("interviewDurationSeconds" / 60.0)::INTEGER
    ELSE 0
  END,
  "settlementConsumedCredits" = 0
WHERE "status" = 'completed'
  AND "settledAt" IS NULL;
