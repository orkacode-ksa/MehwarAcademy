-- AlterTable
ALTER TABLE "regulations" ADD COLUMN     "facultyViolations" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "university_submissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileId" TEXT,
    "title" TEXT NOT NULL,
    "mimeType" TEXT,
    "textContent" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "university_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "university_submissions_tenantId_status_idx" ON "university_submissions"("tenantId", "status");


ALTER TABLE "university_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "university_submissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "university_submissions_tenant_isolation" ON "university_submissions"
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "university_submissions" TO mihwar_app;
