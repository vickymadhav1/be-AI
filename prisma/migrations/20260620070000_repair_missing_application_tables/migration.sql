CREATE TABLE IF NOT EXISTS "Interview" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "experience" INTEGER NOT NULL,
  "difficulty" TEXT NOT NULL,
  "interviewType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'created',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InterviewQuestion" (
  "id" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT,
  "score" INTEGER,
  "feedback" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InterviewQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InterviewSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "company" TEXT,
  "role" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Transcript" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "speaker" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Suggestion" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'THEORY',
  "code" TEXT,
  "output" TEXT,
  "language" TEXT,
  "complexity" TEXT,
  "rootCause" TEXT,
  "fix" TEXT,
  "analysisMode" TEXT NOT NULL DEFAULT 'GENERAL',
  "promptDebug" TEXT NOT NULL DEFAULT '',
  "keyPoints" JSONB NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ScreenContext" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "rawOcrText" TEXT NOT NULL DEFAULT '',
  "ocrConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "captureStatus" TEXT NOT NULL DEFAULT 'working',
  "ocrStatus" TEXT NOT NULL DEFAULT 'pending',
  "code" TEXT NOT NULL DEFAULT '',
  "language" TEXT NOT NULL DEFAULT '',
  "terminalOutput" TEXT NOT NULL DEFAULT '',
  "errors" TEXT NOT NULL DEFAULT '',
  "detectedQuestion" TEXT NOT NULL DEFAULT '',
  "codeDetected" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScreenContext_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Interview_userId_createdAt_idx"
ON "Interview"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "InterviewQuestion_interviewId_createdAt_idx"
ON "InterviewQuestion"("interviewId", "createdAt");
CREATE INDEX IF NOT EXISTS "InterviewSession_userId_startedAt_idx"
ON "InterviewSession"("userId", "startedAt");
CREATE INDEX IF NOT EXISTS "Transcript_sessionId_createdAt_idx"
ON "Transcript"("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "Suggestion_sessionId_createdAt_idx"
ON "Suggestion"("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "ScreenContext_sessionId_createdAt_idx"
ON "ScreenContext"("sessionId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Interview_userId_fkey') THEN
    ALTER TABLE "Interview" ADD CONSTRAINT "Interview_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InterviewQuestion_interviewId_fkey') THEN
    ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_interviewId_fkey"
    FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InterviewSession_userId_fkey') THEN
    ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Transcript_sessionId_fkey') THEN
    ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Suggestion_sessionId_fkey') THEN
    ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScreenContext_sessionId_fkey') THEN
    ALTER TABLE "ScreenContext" ADD CONSTRAINT "ScreenContext_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
