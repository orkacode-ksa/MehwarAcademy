-- AlterTable
ALTER TABLE "generation_jobs" ADD COLUMN     "instructions" TEXT;

-- CreateTable
CREATE TABLE "source_files" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "topicId" TEXT,
    "fileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "textContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "source_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT '',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "audioTokens" INTEGER NOT NULL DEFAULT 0,
    "costSar" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "source_files_courseId_idx" ON "source_files"("courseId");

-- CreateIndex
CREATE INDEX "source_files_tenantId_idx" ON "source_files"("tenantId");

-- CreateIndex
CREATE INDEX "ai_usage_createdAt_idx" ON "ai_usage"("createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_userId_createdAt_idx" ON "ai_usage"("userId", "createdAt");


-- ═══════════════ العزل ═══════════════
ALTER TABLE "source_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "source_files" FORCE ROW LEVEL SECURITY;
CREATE POLICY "source_files_tenant_isolation" ON "source_files"
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());

-- إعدادات المنصة وسجل التكلفة على مستوى المنصة (خارج العزل عمدًا — انظر tenantScope.ts).
GRANT SELECT, INSERT, UPDATE, DELETE ON "source_files", "platform_settings", "ai_usage" TO mihwar_app;
