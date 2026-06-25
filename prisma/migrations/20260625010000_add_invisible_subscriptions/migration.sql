CREATE TABLE IF NOT EXISTS "InvisibleSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "planName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "totalCredits" INTEGER NOT NULL,
  "remainingCredits" INTEGER NOT NULL,
  "totalMinutes" INTEGER NOT NULL,
  "creditsPerMinute" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "paymentId" TEXT,
  "orderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InvisibleSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PaymentRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "razorpayOrderId" TEXT NOT NULL,
  "razorpayPaymentId" TEXT,
  "razorpaySignature" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRecord_razorpayOrderId_key"
ON "PaymentRecord"("razorpayOrderId");

CREATE INDEX IF NOT EXISTS "InvisibleSubscription_userId_status_idx"
ON "InvisibleSubscription"("userId", "status");

CREATE INDEX IF NOT EXISTS "InvisibleSubscription_orderId_idx"
ON "InvisibleSubscription"("orderId");

CREATE INDEX IF NOT EXISTS "PaymentRecord_userId_status_idx"
ON "PaymentRecord"("userId", "status");

ALTER TABLE "InvisibleSubscription"
ADD CONSTRAINT "InvisibleSubscription_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentRecord"
ADD CONSTRAINT "PaymentRecord_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
