-- التسجيل بتأكيد البريد: الطلب يُحفظ هنا حتى يُدخل صاحبه الرمز المرسل إلى بريده.
CREATE TABLE "pending_signups" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sends" INTEGER NOT NULL DEFAULT 1,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_signups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pending_signups_email_idx" ON "pending_signups"("email");
CREATE INDEX "pending_signups_expiresAt_idx" ON "pending_signups"("expiresAt");
