ALTER TABLE "InterviewSession"
ADD COLUMN "interviewRunning" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "activeRunStartedAt" TIMESTAMP(3),
ADD COLUMN "interviewDurationSeconds" INTEGER NOT NULL DEFAULT 0;

UPDATE "InterviewSession"
SET "interviewDurationSeconds" = GREATEST(
  0,
  FLOOR(EXTRACT(EPOCH FROM ("endedAt" - "startedAt")))::INTEGER
)
WHERE "status" = 'completed'
  AND "endedAt" IS NOT NULL;
