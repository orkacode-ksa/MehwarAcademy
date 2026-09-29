-- تغيير البريد من الحساب نفسه: رمز تأكيد يُرسل إلى البريد الجديد (مُجزّأ · مرة واحدة · مدة قصيرة).
CREATE TABLE "email_change_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "email_change_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_change_tokens_tokenHash_key" ON "email_change_tokens"("tokenHash");
CREATE INDEX "email_change_tokens_userId_idx" ON "email_change_tokens"("userId");

ALTER TABLE "email_change_tokens" ADD CONSTRAINT "email_change_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
