ALTER TABLE "Suggestion"
ADD COLUMN "type" TEXT NOT NULL DEFAULT 'THEORY',
ADD COLUMN "code" TEXT,
ADD COLUMN "language" TEXT,
ADD COLUMN "complexity" TEXT,
ADD COLUMN "rootCause" TEXT,
ADD COLUMN "fix" TEXT;

CREATE TABLE "ScreenContext" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenContext_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScreenContext_sessionId_createdAt_idx" ON "ScreenContext"("sessionId", "createdAt");

ALTER TABLE "ScreenContext" ADD CONSTRAINT "ScreenContext_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
