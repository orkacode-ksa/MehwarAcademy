-- الاختبارات الإلكترونية: أسئلة منظَّمة على الاختبار، ومحاولة واحدة لكل طالب.
ALTER TABLE "assessments"
  ADD COLUMN "online" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "questions" JSONB,
  ADD COLUMN "opensAt" TIMESTAMP(3),
  ADD COLUMN "closesAt" TIMESTAMP(3),
  ADD COLUMN "durationMin" INTEGER,
  ADD COLUMN "showScore" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "shuffle" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "exam_attempts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "order" JSONB NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "manualPoints" JSONB NOT NULL DEFAULT '{}',
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "score" DECIMAL(6,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exam_attempts_assessmentId_enrollmentId_key" ON "exam_attempts"("assessmentId", "enrollmentId");
CREATE INDEX "exam_attempts_workspaceId_idx" ON "exam_attempts"("workspaceId");
CREATE INDEX "exam_attempts_tenantId_idx" ON "exam_attempts"("tenantId");

ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exam_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_attempts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exam_attempts_tenant_isolation" ON "exam_attempts"
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "exam_attempts" TO mihwar_app;
