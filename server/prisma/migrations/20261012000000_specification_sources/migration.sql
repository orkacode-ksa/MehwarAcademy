BEGIN;

-- DropForeignKey
ALTER TABLE "program_specifications" DROP CONSTRAINT "program_specifications_tenantId_id_currentExtractionId_fkey";

-- DropForeignKey
ALTER TABLE "program_specifications" DROP CONSTRAINT "program_specifications_tenantId_id_currentReviewId_fkey";

-- DropForeignKey
ALTER TABLE "program_specifications" DROP CONSTRAINT "program_specifications_tenantId_id_currentApprovalId_fkey";

-- DropForeignKey
ALTER TABLE "program_spec_reviews" DROP CONSTRAINT "program_spec_reviews_tenantId_programSpecificationId_extra_fkey";

-- DropForeignKey
ALTER TABLE "program_spec_approvals" DROP CONSTRAINT "program_spec_approvals_tenantId_programSpecificationId_rev_fkey";

-- DropForeignKey
ALTER TABLE "program_spec_publications" DROP CONSTRAINT "program_spec_publications_tenantId_programSpecificationId__fkey";

-- AlterTable
ALTER TABLE "program_specifications" ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceProgramKey" TEXT;

-- Tracks may share a program and version. Preserve the old uniqueness for legacy inputs.
DROP INDEX "program_specifications_tenantId_programId_version_key";
CREATE UNIQUE INDEX "program_specifications_tenantId_programId_sourceProgramKey__key"
  ON "program_specifications" ("tenantId", "programId", "sourceProgramKey", "version");
CREATE UNIQUE INDEX "program_specifications_legacy_program_version_key"
  ON "program_specifications" ("tenantId", "programId", "version") WHERE "sourceProgramKey" IS NULL;

-- AlterTable
ALTER TABLE "program_spec_extractions" ADD COLUMN     "sourceId" TEXT,
ALTER COLUMN "programSpecificationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "program_spec_reviews" ADD COLUMN     "sourceId" TEXT,
ALTER COLUMN "programSpecificationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "program_spec_approvals" ADD COLUMN     "sourceId" TEXT,
ALTER COLUMN "programSpecificationId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "specification_sources" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "legacyImported" BOOLEAN NOT NULL DEFAULT false,
    "legacyUploadedById" TEXT,
    "fileSha256" TEXT NOT NULL,
    "title" TEXT,
    "sourceUrl" TEXT,
    "extractionStatus" "SpecificationExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewStatus" "SpecificationReviewStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "approvalStatus" "SpecificationApprovalStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "currentExtractionId" TEXT,
    "currentReviewId" TEXT,
    "currentApprovalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specification_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "specification_sources_tenantId_fileSha256_idx" ON "specification_sources"("tenantId", "fileSha256");

-- CreateIndex
CREATE INDEX "specification_sources_tenantId_uploadedById_createdAt_idx" ON "specification_sources"("tenantId", "uploadedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "specification_sources_tenantId_id_key" ON "specification_sources"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "specification_sources_tenantId_id_currentExtractionId_key" ON "specification_sources"("tenantId", "id", "currentExtractionId");

-- CreateIndex
CREATE UNIQUE INDEX "specification_sources_tenantId_id_currentReviewId_key" ON "specification_sources"("tenantId", "id", "currentReviewId");

-- CreateIndex
CREATE UNIQUE INDEX "specification_sources_tenantId_id_currentApprovalId_key" ON "specification_sources"("tenantId", "id", "currentApprovalId");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_id_key" ON "users"("tenantId", "id");

-- CreateIndex
CREATE INDEX "program_specifications_tenantId_sourceId_idx" ON "program_specifications"("tenantId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "program_specifications_tenantId_sourceId_sourceProgramKey_v_key" ON "program_specifications"("tenantId", "sourceId", "sourceProgramKey", "version");

-- CreateIndex
CREATE UNIQUE INDEX "program_spec_extractions_tenantId_sourceId_id_key" ON "program_spec_extractions"("tenantId", "sourceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "program_spec_extractions_tenantId_sourceId_attempt_key" ON "program_spec_extractions"("tenantId", "sourceId", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "program_spec_reviews_tenantId_sourceId_id_key" ON "program_spec_reviews"("tenantId", "sourceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "program_spec_reviews_tenantId_sourceId_revision_key" ON "program_spec_reviews"("tenantId", "sourceId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "program_spec_approvals_tenantId_sourceId_id_key" ON "program_spec_approvals"("tenantId", "sourceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "program_spec_approvals_tenantId_sourceId_reviewId_key" ON "program_spec_approvals"("tenantId", "sourceId", "reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "program_spec_approvals_tenantId_id_key" ON "program_spec_approvals"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "program_specifications" ADD CONSTRAINT "program_specifications_tenantId_sourceId_fkey" FOREIGN KEY ("tenantId", "sourceId") REFERENCES "specification_sources"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_specifications" ADD CONSTRAINT "program_specifications_tenantId_sourceId_currentExtraction_fkey" FOREIGN KEY ("tenantId", "sourceId", "currentExtractionId") REFERENCES "program_spec_extractions"("tenantId", "sourceId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_specifications" ADD CONSTRAINT "program_specifications_tenantId_sourceId_currentReviewId_fkey" FOREIGN KEY ("tenantId", "sourceId", "currentReviewId") REFERENCES "program_spec_reviews"("tenantId", "sourceId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_specifications" ADD CONSTRAINT "program_specifications_tenantId_sourceId_currentApprovalId_fkey" FOREIGN KEY ("tenantId", "sourceId", "currentApprovalId") REFERENCES "program_spec_approvals"("tenantId", "sourceId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_spec_extractions" ADD CONSTRAINT "program_spec_extractions_tenantId_sourceId_fkey" FOREIGN KEY ("tenantId", "sourceId") REFERENCES "specification_sources"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_spec_reviews" ADD CONSTRAINT "program_spec_reviews_tenantId_sourceId_extractionId_fkey" FOREIGN KEY ("tenantId", "sourceId", "extractionId") REFERENCES "program_spec_extractions"("tenantId", "sourceId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_spec_reviews" ADD CONSTRAINT "program_spec_reviews_tenantId_sourceId_fkey" FOREIGN KEY ("tenantId", "sourceId") REFERENCES "specification_sources"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_spec_approvals" ADD CONSTRAINT "program_spec_approvals_tenantId_sourceId_reviewId_fkey" FOREIGN KEY ("tenantId", "sourceId", "reviewId") REFERENCES "program_spec_reviews"("tenantId", "sourceId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_spec_approvals" ADD CONSTRAINT "program_spec_approvals_tenantId_sourceId_fkey" FOREIGN KEY ("tenantId", "sourceId") REFERENCES "specification_sources"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "program_spec_publications" ADD CONSTRAINT "program_spec_publications_tenantId_approvalId_fkey" FOREIGN KEY ("tenantId", "approvalId") REFERENCES "program_spec_approvals"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "specification_sources" ADD CONSTRAINT "specification_sources_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specification_sources" ADD CONSTRAINT "specification_sources_tenantId_fileId_fkey" FOREIGN KEY ("tenantId", "fileId") REFERENCES "file_assets"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "specification_sources" ADD CONSTRAINT "specification_sources_tenantId_uploadedById_fkey" FOREIGN KEY ("tenantId", "uploadedById") REFERENCES "users"("tenantId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "specification_sources" ADD CONSTRAINT "specification_sources_tenantId_id_currentExtractionId_fkey" FOREIGN KEY ("tenantId", "id", "currentExtractionId") REFERENCES "program_spec_extractions"("tenantId", "sourceId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "specification_sources" ADD CONSTRAINT "specification_sources_tenantId_id_currentReviewId_fkey" FOREIGN KEY ("tenantId", "id", "currentReviewId") REFERENCES "program_spec_reviews"("tenantId", "sourceId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "specification_sources" ADD CONSTRAINT "specification_sources_tenantId_id_currentApprovalId_fkey" FOREIGN KEY ("tenantId", "id", "currentApprovalId") REFERENCES "program_spec_approvals"("tenantId", "sourceId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Custom source ownership, compatibility, and decision guards. Prisma DDL is prepended.
ALTER TABLE "program_specifications" DISABLE TRIGGER USER;
ALTER TABLE "program_spec_extractions" DISABLE TRIGGER USER;
ALTER TABLE "program_spec_reviews" DISABLE TRIGGER USER;
ALTER TABLE "program_spec_approvals" DISABLE TRIGGER USER;

-- Preserve each legacy decision chain independently, including its original author.
INSERT INTO "specification_sources" (
  "id", "tenantId", "fileId", "uploadedById", "legacyImported", "legacyUploadedById",
  "fileSha256", "title", "sourceUrl", "extractionStatus", "reviewStatus", "approvalStatus",
  "currentExtractionId", "currentReviewId", "currentApprovalId", "createdAt", "updatedAt"
)
SELECT 'c' || md5('specification-source:' || s."id"), s."tenantId", s."sourceFileId", u."id", true, f."uploadedById",
  s."sourceFileSha256", s."title", s."sourceUrl", s."extractionStatus", s."reviewStatus", s."approvalStatus",
  NULL, NULL, NULL, s."createdAt", s."createdAt"
FROM "program_specifications" s
JOIN "file_assets" f ON f."tenantId" = s."tenantId" AND f."id" = s."sourceFileId"
LEFT JOIN "users" u ON u."tenantId" = s."tenantId" AND u."id" = f."uploadedById";
UPDATE "program_spec_extractions" e SET "sourceId" = 'c' || md5('specification-source:' || s."id")
  FROM "program_specifications" s WHERE s."tenantId" = e."tenantId" AND s."id" = e."programSpecificationId";
UPDATE "program_spec_reviews" r SET "sourceId" = 'c' || md5('specification-source:' || s."id")
  FROM "program_specifications" s WHERE s."tenantId" = r."tenantId" AND s."id" = r."programSpecificationId";
UPDATE "program_spec_approvals" a SET "sourceId" = 'c' || md5('specification-source:' || s."id")
  FROM "program_specifications" s WHERE s."tenantId" = a."tenantId" AND s."id" = a."programSpecificationId";
UPDATE "program_specifications" SET "sourceId" = 'c' || md5('specification-source:' || "id");
UPDATE "specification_sources" x SET "currentExtractionId" = s."currentExtractionId",
  "currentReviewId" = s."currentReviewId", "currentApprovalId" = s."currentApprovalId"
  FROM "program_specifications" s WHERE x."tenantId" = s."tenantId" AND x."id" = s."sourceId";

-- Nullable Prisma inputs keep old callers working; BEFORE triggers fill ownership.
ALTER TABLE "program_specifications" ADD CONSTRAINT "program_spec_source_required" CHECK ("sourceId" IS NOT NULL);
ALTER TABLE "program_spec_extractions" ADD CONSTRAINT "program_spec_extraction_source_required" CHECK ("sourceId" IS NOT NULL);
ALTER TABLE "program_spec_reviews" ADD CONSTRAINT "program_spec_review_source_required" CHECK ("sourceId" IS NOT NULL);
ALTER TABLE "program_spec_approvals" ADD CONSTRAINT "program_spec_approval_source_required" CHECK ("sourceId" IS NOT NULL);
ALTER TABLE "specification_sources" ADD CONSTRAINT "specification_source_uploader_required"
  CHECK ("uploadedById" IS NOT NULL OR ("legacyImported" AND "legacyUploadedById" IS NOT NULL));
ALTER TABLE "specification_sources" ADD CONSTRAINT "specification_source_sha256"
  CHECK ("legacyImported" OR "fileSha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "specification_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "specification_sources" FORCE ROW LEVEL SECURITY;
CREATE POLICY "specification_sources_tenant_isolation" ON "specification_sources"
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "specification_sources" TO mihwar_app;

CREATE FUNCTION mihwar_bind_program_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE f "file_assets"; x "specification_sources";
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."approvalStatus" = 'APPROVED' THEN
    RAISE EXCEPTION 'program_specifications is immutable after APPROVED' USING ERRCODE = '23514';
  END IF;
  IF NEW."sourceId" IS NULL AND TG_OP = 'INSERT' THEN
    SELECT * INTO f FROM "file_assets" WHERE "tenantId" = NEW."tenantId" AND "id" = NEW."sourceFileId" FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Foreign key constraint violated: source file does not belong to this tenant' USING ERRCODE = '23503';
    END IF;
    NEW."sourceId" := 'c' || md5('specification-source:' || NEW."id");
    INSERT INTO "specification_sources" ("id", "tenantId", "fileId", "uploadedById", "legacyImported",
      "legacyUploadedById", "fileSha256", "title", "sourceUrl", "createdAt", "updatedAt")
    VALUES (NEW."sourceId", NEW."tenantId", f."id",
      (SELECT "id" FROM "users" WHERE "tenantId" = NEW."tenantId" AND "id" = f."uploadedById"),
      true, f."uploadedById", NEW."sourceFileSha256", NEW."title", NEW."sourceUrl", NEW."createdAt", NEW."createdAt");
  END IF;
  SELECT * INTO x FROM "specification_sources" WHERE "tenantId" = NEW."tenantId" AND "id" = NEW."sourceId" FOR SHARE;
  IF FOUND AND (x."fileId" <> NEW."sourceFileId" OR x."fileSha256" <> NEW."sourceFileSha256") THEN
    RAISE EXCEPTION 'Specification must retain its exact source file and hash' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."sourceId" IS DISTINCT FROM OLD."sourceId" THEN
    RAISE EXCEPTION 'Specification source ownership is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER aa_program_specification_source BEFORE INSERT OR UPDATE ON "program_specifications"
  FOR EACH ROW EXECUTE FUNCTION mihwar_bind_program_source();

CREATE FUNCTION mihwar_bind_source_decision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_source TEXT;
BEGIN
  IF NEW."programSpecificationId" IS NOT NULL THEN
    SELECT "sourceId" INTO expected_source FROM "program_specifications"
      WHERE "tenantId" = NEW."tenantId" AND "id" = NEW."programSpecificationId";
    IF NEW."sourceId" IS NULL THEN NEW."sourceId" := expected_source; END IF;
    IF NEW."sourceId" IS DISTINCT FROM expected_source THEN
      RAISE EXCEPTION 'Legacy decision and source belong to different specifications' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW."sourceId" IS DISTINCT FROM OLD."sourceId"
    OR NEW."programSpecificationId" IS DISTINCT FROM OLD."programSpecificationId") THEN
    RAISE EXCEPTION 'Decision source ownership is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER aa_extraction_source BEFORE INSERT OR UPDATE ON "program_spec_extractions"
  FOR EACH ROW EXECUTE FUNCTION mihwar_bind_source_decision();
CREATE TRIGGER aa_review_source BEFORE INSERT OR UPDATE ON "program_spec_reviews"
  FOR EACH ROW EXECUTE FUNCTION mihwar_bind_source_decision();
CREATE TRIGGER aa_approval_source BEFORE INSERT OR UPDATE ON "program_spec_approvals"
  FOR EACH ROW EXECUTE FUNCTION mihwar_bind_source_decision();

CREATE FUNCTION mihwar_validate_specification_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE f "file_assets";
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Specification source identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND
    (to_jsonb(NEW) - ARRAY['extractionStatus','reviewStatus','approvalStatus','currentExtractionId','currentReviewId','currentApprovalId','updatedAt'])
      IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['extractionStatus','reviewStatus','approvalStatus','currentExtractionId','currentReviewId','currentApprovalId','updatedAt']) THEN
    RAISE EXCEPTION 'Specification source identity is immutable' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO f FROM "file_assets" WHERE "tenantId" = NEW."tenantId" AND "id" = NEW."fileId" FOR SHARE;
  IF FOUND AND f."deletedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Specification source file is deleted' USING ERRCODE = '23514';
  END IF;
  IF NOT NEW."legacyImported" AND (f."uploadedById" IS DISTINCT FROM NEW."uploadedById"
    OR f."purpose" <> 'UNIVERSITY' OR f."mimeType" NOT IN
      ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) THEN
    RAISE EXCEPTION 'Source requires an official file from its uploader' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND NOT NEW."legacyImported" AND f."storage" = 'DB' AND NOT EXISTS (
    SELECT 1 FROM "file_blobs" b WHERE b."tenantId" = NEW."tenantId" AND b."fileId" = NEW."fileId"
      AND encode(sha256(b."data"), 'hex') = NEW."fileSha256" AND octet_length(b."data") = f."sizeBytes"
  ) THEN
    RAISE EXCEPTION 'Specification source hash must match its uploaded bytes' USING ERRCODE = '23514';
  END IF;
  IF NEW."approvalStatus" = 'APPROVED' AND (NEW."extractionStatus" <> 'SUCCEEDED' OR NEW."reviewStatus" <> 'COMPLETED'
    OR NOT EXISTS (
      SELECT 1 FROM "program_spec_approvals" a JOIN "program_spec_reviews" r
        ON r."tenantId" = a."tenantId" AND r."sourceId" = a."sourceId" AND r."id" = a."reviewId"
      WHERE a."tenantId" = NEW."tenantId" AND a."sourceId" = NEW."id" AND a."id" = NEW."currentApprovalId"
        AND a."status" = 'APPROVED' AND r."id" = NEW."currentReviewId" AND r."extractionId" = NEW."currentExtractionId"
    )) THEN
    RAISE EXCEPTION 'Approved source requires its exact approved decision chain' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER specification_source_valid BEFORE INSERT OR UPDATE OR DELETE ON "specification_sources"
  FOR EACH ROW EXECUTE FUNCTION mihwar_validate_specification_source();

-- Existing per-program callers retain their progress semantics; normal multi-program sources do not.
CREATE FUNCTION mihwar_sync_legacy_source_progress() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "specification_sources" SET "extractionStatus" = NEW."extractionStatus", "reviewStatus" = NEW."reviewStatus",
    "approvalStatus" = NEW."approvalStatus", "currentExtractionId" = NEW."currentExtractionId",
    "currentReviewId" = NEW."currentReviewId", "currentApprovalId" = NEW."currentApprovalId", "updatedAt" = CURRENT_TIMESTAMP
    WHERE "tenantId" = NEW."tenantId" AND "id" = NEW."sourceId" AND "legacyImported"
      AND "id" = 'c' || md5('specification-source:' || NEW."id");
  RETURN NEW;
END; $$;
CREATE TRIGGER program_spec_source_progress AFTER INSERT OR UPDATE ON "program_specifications"
  FOR EACH ROW EXECUTE FUNCTION mihwar_sync_legacy_source_progress();

CREATE OR REPLACE FUNCTION mihwar_validate_spec_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE snapshot JSONB; is_legacy BOOLEAN;
BEGIN
  IF NEW."status" = 'APPROVED' THEN
    SELECT r."reviewedData", x."legacyImported" INTO snapshot, is_legacy
      FROM "program_spec_reviews" r JOIN "program_spec_extractions" e
        ON e."tenantId" = r."tenantId" AND e."sourceId" = r."sourceId" AND e."id" = r."extractionId"
      JOIN "specification_sources" x ON x."tenantId" = r."tenantId" AND x."id" = r."sourceId"
      WHERE r."tenantId" = NEW."tenantId" AND r."sourceId" = NEW."sourceId" AND r."id" = NEW."reviewId"
        AND r."status" = 'COMPLETED' AND e."status" = 'SUCCEEDED' AND r."contentHash" = NEW."contentHash";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Approval requires a completed review of a successful extraction with matching contentHash' USING ERRCODE = '23514';
    END IF;
    IF NOT is_legacy THEN
      IF jsonb_typeof(snapshot -> 'programs') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Source approval requires a programs array' USING ERRCODE = '23514';
      END IF;
      IF jsonb_array_length(snapshot -> 'programs') = 0 OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(snapshot -> 'programs') p
        WHERE COALESCE(trim(p ->> 'key'), '') = '' OR COALESCE(trim(p #>> '{program,code}'), '') = ''
          OR COALESCE(trim(p #>> '{specification,version}'), '') = '' OR COALESCE(trim(p #>> '{specification,title}'), '') = ''
      ) OR EXISTS (SELECT 1 FROM jsonb_array_elements(snapshot -> 'programs') p GROUP BY p ->> 'key' HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Every approved program requires a unique key, program code, title and version' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION mihwar_validate_approved_spec() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE snapshot JSONB; is_legacy BOOLEAN; entry JSONB; program_code TEXT; department_code TEXT; college_code TEXT;
BEGIN
  IF NEW."approvalStatus" = 'APPROVED' THEN
    SELECT r."reviewedData", x."legacyImported" INTO snapshot, is_legacy
      FROM "program_spec_approvals" a JOIN "program_spec_reviews" r
        ON r."tenantId" = a."tenantId" AND r."sourceId" = a."sourceId" AND r."id" = a."reviewId"
      JOIN "specification_sources" x ON x."tenantId" = a."tenantId" AND x."id" = a."sourceId"
      WHERE a."tenantId" = NEW."tenantId" AND a."sourceId" = NEW."sourceId"
        AND a."id" = NEW."currentApprovalId" AND a."status" = 'APPROVED'
        AND r."id" = NEW."currentReviewId" AND r."extractionId" = NEW."currentExtractionId";
    IF NOT FOUND OR NEW."extractionStatus" <> 'SUCCEEDED' OR NEW."reviewStatus" <> 'COMPLETED' THEN
      RAISE EXCEPTION 'Approved specification requires its exact approved review and extraction' USING ERRCODE = '23514';
    END IF;
    IF NOT is_legacy THEN
      SELECT p INTO entry FROM jsonb_array_elements(snapshot -> 'programs') p WHERE p ->> 'key' = NEW."sourceProgramKey";
      SELECT p."code", d."code", c."code" INTO program_code, department_code, college_code FROM "programs" p
        JOIN "departments" d ON d."tenantId" = p."tenantId" AND d."id" = p."departmentId"
        LEFT JOIN "colleges" c ON c."tenantId" = d."tenantId" AND c."id" = d."collegeId"
        WHERE p."tenantId" = NEW."tenantId" AND p."id" = NEW."programId";
      IF entry IS NULL OR entry #>> '{specification,version}' IS DISTINCT FROM NEW."version"
        OR entry #>> '{specification,title}' IS DISTINCT FROM NEW."title"
        OR entry #>> '{program,code}' IS DISTINCT FROM program_code
        OR (entry #>> '{department,code}' IS NOT NULL AND entry #>> '{department,code}' IS DISTINCT FROM department_code)
        OR (entry #>> '{college,code}' IS NOT NULL AND entry #>> '{college,code}' IS DISTINCT FROM college_code) THEN
        RAISE EXCEPTION 'Program specification must match an approved program in its source' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION mihwar_validate_spec_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" = 'PUBLISHED' AND NOT EXISTS (
    SELECT 1 FROM "program_specifications" s JOIN "program_spec_approvals" a
      ON a."tenantId" = s."tenantId" AND a."sourceId" = s."sourceId" AND a."id" = s."currentApprovalId"
    WHERE s."tenantId" = NEW."tenantId" AND s."id" = NEW."programSpecificationId"
      AND s."approvalStatus" = 'APPROVED' AND a."id" = NEW."approvalId" AND a."status" = 'APPROVED'
  ) THEN
    RAISE EXCEPTION 'Publication requires the approved specification and its current approval' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION mihwar_guard_spec_source_file() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "specification_sources" WHERE "tenantId" = OLD."tenantId" AND "fileId" = OLD."id")
    OR EXISTS (SELECT 1 FROM "program_specifications" WHERE "tenantId" = OLD."tenantId" AND "sourceFileId" = OLD."id") THEN
    IF TG_OP = 'DELETE' OR (to_jsonb(NEW) - 'storage') IS DISTINCT FROM (to_jsonb(OLD) - 'storage')
      OR (NEW."storage" IS DISTINCT FROM OLD."storage" AND NOT (OLD."storage" = 'DB' AND NEW."storage" = 'R2')) THEN
      RAISE EXCEPTION 'Official specification source file is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION mihwar_guard_spec_source_blob() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE file_storage TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM "specification_sources" WHERE "tenantId" = OLD."tenantId" AND "fileId" = OLD."fileId")
    OR EXISTS (SELECT 1 FROM "program_specifications" WHERE "tenantId" = OLD."tenantId" AND "sourceFileId" = OLD."fileId") THEN
    SELECT "storage" INTO file_storage FROM "file_assets" WHERE "tenantId" = OLD."tenantId" AND "id" = OLD."fileId" FOR SHARE;
    IF TG_OP = 'UPDATE' OR file_storage = 'DB' THEN
      RAISE EXCEPTION 'Official specification source content is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

-- Extend the private helper while keeping its existing privilege boundary.
CREATE OR REPLACE FUNCTION mihwar_wipe_spec_catalog(p_keep_tenants TEXT[]) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  ALTER TABLE "specification_sources" DISABLE TRIGGER USER;
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
  UPDATE "program_specifications" SET "currentExtractionId" = NULL, "currentReviewId" = NULL, "currentApprovalId" = NULL
    WHERE "tenantId" <> ALL (p_keep_tenants);
  UPDATE "specification_sources" SET "currentExtractionId" = NULL, "currentReviewId" = NULL, "currentApprovalId" = NULL
    WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "program_spec_approvals" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "program_spec_reviews" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "program_spec_extractions" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "program_specifications" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "specification_sources" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "programs" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "departments" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "colleges" WHERE "tenantId" <> ALL (p_keep_tenants);
  ALTER TABLE "specification_sources" ENABLE TRIGGER USER;
  ALTER TABLE "program_specifications" ENABLE TRIGGER USER;
  ALTER TABLE "program_spec_extractions" ENABLE TRIGGER USER;
  ALTER TABLE "program_spec_reviews" ENABLE TRIGGER USER;
  ALTER TABLE "program_spec_approvals" ENABLE TRIGGER USER;
  ALTER TABLE "program_spec_publications" ENABLE TRIGGER USER;
  ALTER TABLE "course_templates" ENABLE TRIGGER USER;
  ALTER TABLE "course_template_topics" ENABLE TRIGGER USER;
END; $$;
REVOKE ALL ON FUNCTION mihwar_wipe_spec_catalog(TEXT[]) FROM PUBLIC;

ALTER TABLE "program_specifications" ENABLE TRIGGER USER;
ALTER TABLE "program_spec_extractions" ENABLE TRIGGER USER;
ALTER TABLE "program_spec_reviews" ENABLE TRIGGER USER;
ALTER TABLE "program_spec_approvals" ENABLE TRIGGER USER;

COMMIT;
