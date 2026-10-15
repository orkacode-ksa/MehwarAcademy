-- CreateEnum
CREATE TYPE "SpecificationExtractionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "SpecificationReviewStatus" AS ENUM ('NOT_STARTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SpecificationApprovalStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SpecificationPublicationStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "collegeId" TEXT;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "assessmentPlan" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "courseTemplateId" TEXT;

-- AlterTable
ALTER TABLE "topics" ADD COLUMN     "sourceTemplateTopicId" TEXT;

-- CreateTable
CREATE TABLE "colleges" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "colleges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_specifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "sourceFileId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceFileSha256" TEXT NOT NULL,
    "extractionStatus" "SpecificationExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewStatus" "SpecificationReviewStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "approvalStatus" "SpecificationApprovalStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "currentExtractionId" TEXT,
    "currentReviewId" TEXT,
    "currentApprovalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_spec_extractions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programSpecificationId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "SpecificationExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "model" TEXT,
    "promptVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "rawOutput" JSONB,
    "extractedData" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "program_spec_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_spec_reviews" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programSpecificationId" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "SpecificationReviewStatus" NOT NULL DEFAULT 'IN_REVIEW',
    "draftData" JSONB NOT NULL,
    "reviewedData" JSONB,
    "contentHash" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_spec_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_spec_approvals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programSpecificationId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" "SpecificationApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "program_spec_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_spec_publications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programSpecificationId" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "status" "SpecificationPublicationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "program_spec_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programSpecificationId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "creditHours" INTEGER NOT NULL,
    "hasLab" BOOLEAN NOT NULL DEFAULT false,
    "spec" JSONB NOT NULL DEFAULT '{}',
    "assessmentPlan" JSONB NOT NULL DEFAULT '[]',
    "sourcePages" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_template_topics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courseTemplateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "learningOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourcePages" INTEGER[] DEFAULT ARRAY[]::INTEGER[],

    CONSTRAINT "course_template_topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "colleges_tenantId_idx" ON "colleges"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "colleges_tenantId_id_key" ON "colleges"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "colleges_tenantId_code_key" ON "colleges"("tenantId", "code");

-- CreateIndex
CREATE INDEX "programs_tenantId_idx" ON "programs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "programs_tenantId_id_key" ON "programs"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "programs_tenantId_departmentId_code_key" ON "programs"("tenantId", "departmentId", "code");

-- CreateIndex
CREATE INDEX "program_specifications_tenantId_idx" ON "program_specifications"("tenantId");

-- CreateIndex
CREATE INDEX "program_specifications_tenantId_sourceFileId_idx" ON "program_specifications"("tenantId", "sourceFileId");

-- CreateIndex
CREATE UNIQUE INDEX "program_specifications_tenantId_id_key" ON "program_specifications"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "program_specifications_tenantId_programId_version_key" ON "program_specifications"("tenantId", "programId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "program_specifications_tenantId_id_currentExtractionId_key" ON "program_specifications"("tenantId", "id", "currentExtractionId");

-- CreateIndex
CREATE UNIQUE INDEX "program_specifications_tenantId_id_currentReviewId_key" ON "program_specifications"("tenantId", "id", "currentReviewId");

-- CreateIndex
CREATE UNIQUE INDEX "program_specifications_tenantId_id_currentApprovalId_key" ON "program_specifications"("tenantId", "id", "currentApprovalId");

-- CreateIndex
CREATE INDEX "program_spec_extractions_tenantId_status_idx" ON "program_spec_extractions"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "program_spec_extractions_tenantId_programSpecificationId_id_key" ON "program_spec_extractions"("tenantId", "programSpecificationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "program_spec_extractions_tenantId_programSpecificationId_at_key" ON "program_spec_extractions"("tenantId", "programSpecificationId", "attempt");

-- CreateIndex
CREATE INDEX "program_spec_reviews_tenantId_status_idx" ON "program_spec_reviews"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "program_spec_reviews_tenantId_programSpecificationId_id_key" ON "program_spec_reviews"("tenantId", "programSpecificationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "program_spec_reviews_tenantId_programSpecificationId_revisi_key" ON "program_spec_reviews"("tenantId", "programSpecificationId", "revision");

-- CreateIndex
CREATE INDEX "program_spec_approvals_tenantId_status_idx" ON "program_spec_approvals"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "program_spec_approvals_tenantId_programSpecificationId_id_key" ON "program_spec_approvals"("tenantId", "programSpecificationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "program_spec_approvals_tenantId_programSpecificationId_revi_key" ON "program_spec_approvals"("tenantId", "programSpecificationId", "reviewId");

-- CreateIndex
CREATE INDEX "program_spec_publications_tenantId_status_idx" ON "program_spec_publications"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "program_spec_publications_tenantId_programSpecificationId_key" ON "program_spec_publications"("tenantId", "programSpecificationId");

-- CreateIndex
CREATE UNIQUE INDEX "program_spec_publications_tenantId_programSpecificationId_i_key" ON "program_spec_publications"("tenantId", "programSpecificationId", "id");

-- CreateIndex
CREATE INDEX "course_templates_tenantId_idx" ON "course_templates"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "course_templates_tenantId_id_key" ON "course_templates"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "course_templates_tenantId_programSpecificationId_code_key" ON "course_templates"("tenantId", "programSpecificationId", "code");

-- CreateIndex
CREATE INDEX "course_template_topics_tenantId_idx" ON "course_template_topics"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "course_template_topics_tenantId_id_key" ON "course_template_topics"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "course_template_topics_tenantId_courseTemplateId_orderIndex_key" ON "course_template_topics"("tenantId", "courseTemplateId", "orderIndex");

-- CreateIndex
CREATE INDEX "departments_tenantId_collegeId_idx" ON "departments"("tenantId", "collegeId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenantId_id_key" ON "departments"("tenantId", "id");

-- CreateIndex
CREATE INDEX "courses_tenantId_courseTemplateId_idx" ON "courses"("tenantId", "courseTemplateId");

-- CreateIndex
CREATE INDEX "topics_tenantId_sourceTemplateTopicId_idx" ON "topics"("tenantId", "sourceTemplateTopicId");

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_tenantId_id_key" ON "file_assets"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenantId_collegeId_fkey" FOREIGN KEY ("tenantId", "collegeId") REFERENCES "colleges"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_tenantId_courseTemplateId_fkey" FOREIGN KEY ("tenantId", "courseTemplateId") REFERENCES "course_templates"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_tenantId_sourceTemplateTopicId_fkey" FOREIGN KEY ("tenantId", "sourceTemplateTopicId") REFERENCES "course_template_topics"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "colleges" ADD CONSTRAINT "colleges_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_tenantId_departmentId_fkey" FOREIGN KEY ("tenantId", "departmentId") REFERENCES "departments"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_specifications" ADD CONSTRAINT "program_specifications_tenantId_programId_fkey" FOREIGN KEY ("tenantId", "programId") REFERENCES "programs"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_specifications" ADD CONSTRAINT "program_specifications_tenantId_sourceFileId_fkey" FOREIGN KEY ("tenantId", "sourceFileId") REFERENCES "file_assets"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_specifications" ADD CONSTRAINT "program_specifications_tenantId_id_currentExtractionId_fkey" FOREIGN KEY ("tenantId", "id", "currentExtractionId") REFERENCES "program_spec_extractions"("tenantId", "programSpecificationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_specifications" ADD CONSTRAINT "program_specifications_tenantId_id_currentReviewId_fkey" FOREIGN KEY ("tenantId", "id", "currentReviewId") REFERENCES "program_spec_reviews"("tenantId", "programSpecificationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_specifications" ADD CONSTRAINT "program_specifications_tenantId_id_currentApprovalId_fkey" FOREIGN KEY ("tenantId", "id", "currentApprovalId") REFERENCES "program_spec_approvals"("tenantId", "programSpecificationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_spec_extractions" ADD CONSTRAINT "program_spec_extractions_tenantId_programSpecificationId_fkey" FOREIGN KEY ("tenantId", "programSpecificationId") REFERENCES "program_specifications"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_spec_reviews" ADD CONSTRAINT "program_spec_reviews_tenantId_programSpecificationId_fkey" FOREIGN KEY ("tenantId", "programSpecificationId") REFERENCES "program_specifications"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_spec_reviews" ADD CONSTRAINT "program_spec_reviews_tenantId_programSpecificationId_extra_fkey" FOREIGN KEY ("tenantId", "programSpecificationId", "extractionId") REFERENCES "program_spec_extractions"("tenantId", "programSpecificationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_spec_approvals" ADD CONSTRAINT "program_spec_approvals_tenantId_programSpecificationId_fkey" FOREIGN KEY ("tenantId", "programSpecificationId") REFERENCES "program_specifications"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_spec_approvals" ADD CONSTRAINT "program_spec_approvals_tenantId_programSpecificationId_rev_fkey" FOREIGN KEY ("tenantId", "programSpecificationId", "reviewId") REFERENCES "program_spec_reviews"("tenantId", "programSpecificationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_spec_publications" ADD CONSTRAINT "program_spec_publications_tenantId_programSpecificationId_fkey" FOREIGN KEY ("tenantId", "programSpecificationId") REFERENCES "program_specifications"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_spec_publications" ADD CONSTRAINT "program_spec_publications_tenantId_programSpecificationId__fkey" FOREIGN KEY ("tenantId", "programSpecificationId", "approvalId") REFERENCES "program_spec_approvals"("tenantId", "programSpecificationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "course_templates" ADD CONSTRAINT "course_templates_tenantId_programSpecificationId_fkey" FOREIGN KEY ("tenantId", "programSpecificationId") REFERENCES "program_specifications"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "course_templates" ADD CONSTRAINT "course_templates_tenantId_programSpecificationId_publicati_fkey" FOREIGN KEY ("tenantId", "programSpecificationId", "publicationId") REFERENCES "program_spec_publications"("tenantId", "programSpecificationId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "course_template_topics" ADD CONSTRAINT "course_template_topics_tenantId_courseTemplateId_fkey" FOREIGN KEY ("tenantId", "courseTemplateId") REFERENCES "course_templates"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- The new academic catalog is tenant-scoped, including raw SQL access.

ALTER TABLE "colleges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "colleges" FORCE ROW LEVEL SECURITY;
CREATE POLICY "colleges_tenant_isolation" ON "colleges"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "colleges" TO mihwar_app;

ALTER TABLE "programs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "programs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "programs_tenant_isolation" ON "programs"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "programs" TO mihwar_app;

ALTER TABLE "program_specifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "program_specifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "program_specifications_tenant_isolation" ON "program_specifications"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "program_specifications" TO mihwar_app;

ALTER TABLE "program_spec_extractions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "program_spec_extractions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "program_spec_extractions_tenant_isolation" ON "program_spec_extractions"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "program_spec_extractions" TO mihwar_app;

ALTER TABLE "program_spec_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "program_spec_reviews" FORCE ROW LEVEL SECURITY;
CREATE POLICY "program_spec_reviews_tenant_isolation" ON "program_spec_reviews"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "program_spec_reviews" TO mihwar_app;

ALTER TABLE "program_spec_approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "program_spec_approvals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "program_spec_approvals_tenant_isolation" ON "program_spec_approvals"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "program_spec_approvals" TO mihwar_app;

ALTER TABLE "program_spec_publications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "program_spec_publications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "program_spec_publications_tenant_isolation" ON "program_spec_publications"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "program_spec_publications" TO mihwar_app;

ALTER TABLE "course_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_templates" FORCE ROW LEVEL SECURITY;
CREATE POLICY "course_templates_tenant_isolation" ON "course_templates"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "course_templates" TO mihwar_app;

ALTER TABLE "course_template_topics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_template_topics" FORCE ROW LEVEL SECURITY;
CREATE POLICY "course_template_topics_tenant_isolation" ON "course_template_topics"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "course_template_topics" TO mihwar_app;

-- Freeze approved specifications and their completed decision snapshots.
-- This does not affect legacy courses, topics, or operational gradeScheme.
CREATE FUNCTION mihwar_guard_spec_snapshot() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) ->> TG_ARGV[0]) = ANY (string_to_array(TG_ARGV[1], ',')) THEN
    RAISE EXCEPTION '% is immutable after %', TG_TABLE_NAME, to_jsonb(OLD) ->> TG_ARGV[0]
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER program_specification_immutable
  BEFORE UPDATE OR DELETE ON "program_specifications"
  FOR EACH ROW EXECUTE FUNCTION mihwar_guard_spec_snapshot('approvalStatus', 'APPROVED');
CREATE TRIGGER program_spec_extraction_immutable
  BEFORE UPDATE OR DELETE ON "program_spec_extractions"
  FOR EACH ROW EXECUTE FUNCTION mihwar_guard_spec_snapshot('status', 'SUCCEEDED,FAILED');
CREATE TRIGGER program_spec_review_immutable
  BEFORE UPDATE OR DELETE ON "program_spec_reviews"
  FOR EACH ROW EXECUTE FUNCTION mihwar_guard_spec_snapshot('status', 'COMPLETED');
CREATE TRIGGER program_spec_approval_immutable
  BEFORE UPDATE OR DELETE ON "program_spec_approvals"
  FOR EACH ROW EXECUTE FUNCTION mihwar_guard_spec_snapshot('status', 'APPROVED,REJECTED,CANCELED');
CREATE TRIGGER program_spec_publication_immutable
  BEFORE UPDATE OR DELETE ON "program_spec_publications"
  FOR EACH ROW EXECUTE FUNCTION mihwar_guard_spec_snapshot('status', 'PUBLISHED');

-- Lock the publication row: concurrent edits cannot race final publication.
CREATE FUNCTION mihwar_assert_publication_mutable(p_tenant_id TEXT, p_publication_id TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  publication_status "SpecificationPublicationStatus";
BEGIN
  SELECT "status" INTO publication_status
    FROM "program_spec_publications"
    WHERE "tenantId" = p_tenant_id AND "id" = p_publication_id
    FOR SHARE;
  IF publication_status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published course templates and their topics are immutable'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE FUNCTION mihwar_guard_course_template() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM mihwar_assert_publication_mutable(OLD."tenantId", OLD."publicationId");
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM mihwar_assert_publication_mutable(NEW."tenantId", NEW."publicationId");
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER course_template_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON "course_templates"
  FOR EACH ROW EXECUTE FUNCTION mihwar_guard_course_template();

CREATE FUNCTION mihwar_assert_template_topics_mutable(p_tenant_id TEXT, p_template_id TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  publication_id TEXT;
BEGIN
  SELECT "publicationId" INTO publication_id
    FROM "course_templates"
    WHERE "tenantId" = p_tenant_id AND "id" = p_template_id
    FOR SHARE;
  PERFORM mihwar_assert_publication_mutable(p_tenant_id, publication_id);
END;
$$;

CREATE FUNCTION mihwar_guard_course_template_topic() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM mihwar_assert_template_topics_mutable(OLD."tenantId", OLD."courseTemplateId");
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM mihwar_assert_template_topics_mutable(NEW."tenantId", NEW."courseTemplateId");
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER course_template_topic_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON "course_template_topics"
  FOR EACH ROW EXECUTE FUNCTION mihwar_guard_course_template_topic();

-- Retain official source files while allowing the existing DB-to-R2 relocation.
CREATE FUNCTION mihwar_guard_spec_source_file() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "program_specifications"
    WHERE "tenantId" = OLD."tenantId" AND "sourceFileId" = OLD."id"
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Official specification source file is immutable'
        USING ERRCODE = '23514';
    END IF;
    IF (to_jsonb(NEW) - 'storage') IS DISTINCT FROM (to_jsonb(OLD) - 'storage')
      OR (NEW."storage" IS DISTINCT FROM OLD."storage"
        AND NOT (OLD."storage" = 'DB' AND NEW."storage" = 'R2')) THEN
      RAISE EXCEPTION 'Official specification source file is immutable'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER program_spec_source_file_immutable
  BEFORE UPDATE OR DELETE ON "file_assets"
  FOR EACH ROW EXECUTE FUNCTION mihwar_guard_spec_source_file();

CREATE FUNCTION mihwar_guard_spec_source_blob() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  file_storage TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM "program_specifications"
    WHERE "tenantId" = OLD."tenantId" AND "sourceFileId" = OLD."fileId"
  ) THEN
    SELECT "storage" INTO file_storage FROM "file_assets"
      WHERE "tenantId" = OLD."tenantId" AND "id" = OLD."fileId" FOR SHARE;
    IF TG_OP = 'UPDATE' OR file_storage = 'DB' THEN
      RAISE EXCEPTION 'Official specification source content is immutable'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER program_spec_source_blob_immutable
  BEFORE UPDATE OR DELETE ON "file_blobs"
  FOR EACH ROW EXECUTE FUNCTION mihwar_guard_spec_source_blob();

-- Serialize source registration against soft deletion of the uploaded file.
CREATE FUNCTION mihwar_validate_spec_source() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  source_deleted_at TIMESTAMP(3);
BEGIN
  SELECT "deletedAt" INTO source_deleted_at FROM "file_assets"
    WHERE "tenantId" = NEW."tenantId" AND "id" = NEW."sourceFileId" FOR SHARE;
  IF FOUND AND source_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Official specification source file is deleted'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER program_spec_source_available
  BEFORE INSERT OR UPDATE OF "sourceFileId", "tenantId" ON "program_specifications"
  FOR EACH ROW EXECUTE FUNCTION mihwar_validate_spec_source();

-- Final decisions must identify their author and preserve a complete snapshot.
ALTER TABLE "program_spec_reviews" ADD CONSTRAINT "program_spec_review_completed_snapshot"
  CHECK ("status" <> 'COMPLETED' OR
    ("reviewedData" IS NOT NULL AND "contentHash" IS NOT NULL
      AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL));
ALTER TABLE "program_spec_approvals" ADD CONSTRAINT "program_spec_approval_decision_actor"
  CHECK ("status" NOT IN ('APPROVED', 'REJECTED', 'CANCELED') OR
    ("decidedById" IS NOT NULL AND "decidedAt" IS NOT NULL));
ALTER TABLE "program_spec_publications" ADD CONSTRAINT "program_spec_publication_actor"
  CHECK ("status" <> 'PUBLISHED' OR
    ("publishedById" IS NOT NULL AND "publishedAt" IS NOT NULL));

CREATE FUNCTION mihwar_validate_spec_approval() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" = 'APPROVED' AND NOT EXISTS (
    SELECT 1 FROM "program_spec_reviews" r
    JOIN "program_spec_extractions" e ON e."tenantId" = r."tenantId"
      AND e."programSpecificationId" = r."programSpecificationId" AND e."id" = r."extractionId"
    WHERE r."tenantId" = NEW."tenantId"
      AND r."programSpecificationId" = NEW."programSpecificationId" AND r."id" = NEW."reviewId"
      AND r."status" = 'COMPLETED' AND e."status" = 'SUCCEEDED'
      AND r."contentHash" = NEW."contentHash"
  ) THEN
    RAISE EXCEPTION 'Approval requires a completed review of a successful extraction with matching contentHash'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER program_spec_approval_valid
  BEFORE INSERT OR UPDATE ON "program_spec_approvals"
  FOR EACH ROW EXECUTE FUNCTION mihwar_validate_spec_approval();

CREATE FUNCTION mihwar_validate_approved_spec() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."approvalStatus" = 'APPROVED' AND (
    NEW."extractionStatus" <> 'SUCCEEDED' OR NEW."reviewStatus" <> 'COMPLETED'
    OR NOT EXISTS (
      SELECT 1 FROM "program_spec_approvals" a
      JOIN "program_spec_reviews" r ON r."tenantId" = a."tenantId"
        AND r."programSpecificationId" = a."programSpecificationId" AND r."id" = a."reviewId"
      WHERE a."tenantId" = NEW."tenantId" AND a."programSpecificationId" = NEW."id"
        AND a."id" = NEW."currentApprovalId" AND a."status" = 'APPROVED'
        AND r."id" = NEW."currentReviewId" AND r."extractionId" = NEW."currentExtractionId"
    )
  ) THEN
    RAISE EXCEPTION 'Approved specification requires its exact approved review and extraction'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER program_specification_approval_valid
  BEFORE INSERT OR UPDATE ON "program_specifications"
  FOR EACH ROW EXECUTE FUNCTION mihwar_validate_approved_spec();

CREATE FUNCTION mihwar_validate_spec_publication() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" = 'PUBLISHED' AND NOT EXISTS (
    SELECT 1 FROM "program_specifications" s
    JOIN "program_spec_approvals" a ON a."tenantId" = s."tenantId"
      AND a."programSpecificationId" = s."id" AND a."id" = s."currentApprovalId"
    WHERE s."tenantId" = NEW."tenantId" AND s."id" = NEW."programSpecificationId"
      AND s."approvalStatus" = 'APPROVED' AND a."id" = NEW."approvalId" AND a."status" = 'APPROVED'
  ) THEN
    RAISE EXCEPTION 'Publication requires the approved specification and its current approval'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER program_spec_publication_valid
  BEFORE INSERT OR UPDATE ON "program_spec_publications"
  FOR EACH ROW EXECUTE FUNCTION mihwar_validate_spec_publication();


-- Preserve the existing explicitly authorized platform wipe. The application role
-- cannot call this private helper or disable the immutable triggers directly.
CREATE FUNCTION mihwar_wipe_spec_catalog(p_keep_tenants TEXT[]) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  ALTER TABLE "program_specifications" DISABLE TRIGGER USER;
  ALTER TABLE "program_spec_extractions" DISABLE TRIGGER USER;
  ALTER TABLE "program_spec_reviews" DISABLE TRIGGER USER;
  ALTER TABLE "program_spec_approvals" DISABLE TRIGGER USER;
  ALTER TABLE "program_spec_publications" DISABLE TRIGGER USER;
  ALTER TABLE "course_templates" DISABLE TRIGGER USER;
  ALTER TABLE "course_template_topics" DISABLE TRIGGER USER;

  DELETE FROM "course_template_topics" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "course_templates" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "program_spec_publications" WHERE "tenantId" <> ALL (p_keep_tenants);
  UPDATE "program_specifications"
    SET "currentExtractionId" = NULL, "currentReviewId" = NULL, "currentApprovalId" = NULL
    WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "program_spec_approvals" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "program_spec_reviews" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "program_spec_extractions" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "program_specifications" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "programs" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "departments" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "colleges" WHERE "tenantId" <> ALL (p_keep_tenants);
  ALTER TABLE "program_specifications" ENABLE TRIGGER USER;
  ALTER TABLE "program_spec_extractions" ENABLE TRIGGER USER;
  ALTER TABLE "program_spec_reviews" ENABLE TRIGGER USER;
  ALTER TABLE "program_spec_approvals" ENABLE TRIGGER USER;
  ALTER TABLE "program_spec_publications" ENABLE TRIGGER USER;
  ALTER TABLE "course_templates" ENABLE TRIGGER USER;
  ALTER TABLE "course_template_topics" ENABLE TRIGGER USER;
END;
$$;
REVOKE ALL ON FUNCTION mihwar_wipe_spec_catalog(TEXT[]) FROM PUBLIC;

-- مسح المنصة بطلب المالك: يُفرغ بيانات العملاء كلها ويُبقي حسابات الإدارة وإعداداتها.
--
-- دالة واحدة بصلاحية صاحبها (SECURITY DEFINER) لأن دور التطبيق لا يتجاوز RLS ولا يملك
-- تعطيل مُطلِقات سجل التدقيق — وهذا مقصود: الحذف الشامل لا يُنفَّذ إلا من هذه الدالة،
-- ولا تُستدعى إلا من خدمة تشترط المالك + كلمة مروره + عبارة تأكيد (wipe.service.ts).
--
-- p_keep_tenants: الجامعات التي تحوي حسابات الإدارة (تبقى كما هي مع مستخدميها).
-- p_wipe_audit:   يمسح سجل التدقيق أيضًا. بدونه يبقى السجل، وتفقد صفوف المحذوفين ربطها
--                 باسم صاحبها (userId ← NULL) دون مساس بمحتواها. التعطيل أدناه لمُطلِقات
--                 المستخدم فقط وداخل معاملة الدالة نفسها، فيعود مفعّلًا فور انتهائها.
CREATE OR REPLACE FUNCTION mihwar_wipe_platform(p_keep_tenants TEXT[], p_wipe_audit BOOLEAN)
RETURNS TABLE ("tenants" INTEGER, "users" INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n_tenants INTEGER;
  n_users INTEGER;
  t RECORD;
BEGIN
  IF p_keep_tenants IS NULL OR array_length(p_keep_tenants, 1) IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد جامعة الإدارة المحفوظة';
  END IF;

  ALTER TABLE "audit_logs" DISABLE TRIGGER USER;

  -- بيانات بلا مستأجر: كلها تخص العملاء
  DELETE FROM "orders";
  DELETE FROM "bank_courses";
  DELETE FROM "pending_signups";
  DELETE FROM "ai_usage";
  DELETE FROM "webhook_events";
  DELETE FROM "notifications";

  -- ما يمنع حذف المستأجر (RESTRICT) أولًا
  DELETE FROM "subscriptions" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "workspaces" WHERE "tenantId" <> ALL (p_keep_tenants);

  -- Remove immutable academic catalogs in dependency order before generic cleanup.
  PERFORM mihwar_wipe_spec_catalog(p_keep_tenants);

  -- كل جدول يحمل tenantId ولم تُزله التتالية (ملفات · محفظة · توليد · مصادر …):
  -- بحث ديناميكي لا قائمة يدوية، فلا يفوت المسحَ جدولٌ يُضاف لاحقًا.
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'tenantId'
      AND c.table_name NOT IN ('users', 'tenants', 'audit_logs', 'workspaces', 'subscriptions')
  LOOP
    EXECUTE format('DELETE FROM %I WHERE "tenantId" <> ALL ($1)', t.table_name) USING p_keep_tenants;
  END LOOP;

  WITH d AS (DELETE FROM "users" WHERE "tenantId" <> ALL (p_keep_tenants) RETURNING 1)
  SELECT COUNT(*)::int INTO n_users FROM d;

  WITH d AS (DELETE FROM "tenants" WHERE "id" <> ALL (p_keep_tenants) RETURNING 1)
  SELECT COUNT(*)::int INTO n_tenants FROM d;

  IF p_wipe_audit THEN
    DELETE FROM "audit_logs";
  END IF;

  ALTER TABLE "audit_logs" ENABLE TRIGGER USER;

  tenants := n_tenants;
  users := n_users;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION mihwar_wipe_platform(TEXT[], BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mihwar_wipe_platform(TEXT[], BOOLEAN) TO mihwar_app;




