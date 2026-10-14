-- Course specification version core only: no review/approval/publication workflow,
-- no inferred official version or course type, and no backfill.
CREATE TYPE "CourseSpecificationType" AS ENUM (
    'STANDARD_COURSE', 'FIELD_TRAINING', 'COOPERATIVE_TRAINING',
    'GRADUATION_PROJECT', 'OTHER'
);

CREATE TYPE "CourseSpecificationVersionStatus" AS ENUM (
    'DRAFT', 'IN_REVIEW', 'READY_FOR_APPROVAL', 'APPROVAL_PENDING', 'APPROVED'
);

CREATE TABLE "course_spec_versions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicCourseId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "sourceCourseKey" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "officialVersion" TEXT,
    "issuedAt" TIMESTAMP(3),
    "lastRevisionAt" TIMESTAMP(3),
    "specificationType" "CourseSpecificationType",
    "status" "CourseSpecificationVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "schemaVersion" TEXT NOT NULL DEFAULT 'course-specification-1',
    "extractedData" JSONB NOT NULL,
    "reviewedData" JSONB,
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "sourcePages" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "issues" JSONB NOT NULL DEFAULT '[]',
    "contentHash" TEXT,
    "creationKey" TEXT,
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_spec_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "course_version_positive_revision" CHECK ("revisionNumber" > 0),
    CONSTRAINT "course_version_source_key_nonempty" CHECK ("sourceCourseKey" ~ '[^[:space:]]'),
    CONSTRAINT "course_version_not_self_supersedes" CHECK ("supersedesId" IS NULL OR "supersedesId" <> "id"),
    -- Native array predicates only; page bounds against the PDF remain application validation.
    CONSTRAINT "course_version_positive_source_pages" CHECK (
        array_position("sourcePages", NULL) IS NULL AND 0 < ALL ("sourcePages")
    )
);

CREATE UNIQUE INDEX "course_spec_versions_tenantId_id_key"
    ON "course_spec_versions"("tenantId", "id");

CREATE UNIQUE INDEX "course_spec_versions_tenantId_sourceId_id_key"
    ON "course_spec_versions"("tenantId", "sourceId", "id");

CREATE UNIQUE INDEX "course_spec_versions_tenantId_academicCourseId_id_key"
    ON "course_spec_versions"("tenantId", "academicCourseId", "id");

CREATE UNIQUE INDEX "course_version_revision_key"
    ON "course_spec_versions"("tenantId", "academicCourseId", "revisionNumber");

-- PostgreSQL's default NULLS DISTINCT semantics allow multiple absent creation keys.
CREATE UNIQUE INDEX "course_spec_versions_tenantId_creationKey_key"
    ON "course_spec_versions"("tenantId", "creationKey");

-- Deliberately non-unique: a later corrected revision may reuse this extraction entry.
CREATE INDEX "course_version_origin_idx"
    ON "course_spec_versions"("tenantId", "sourceId", "extractionId", "sourceCourseKey");

CREATE INDEX "course_spec_versions_tenantId_academicCourseId_idx"
    ON "course_spec_versions"("tenantId", "academicCourseId");

CREATE INDEX "course_spec_versions_tenantId_status_idx"
    ON "course_spec_versions"("tenantId", "status");

ALTER TABLE "course_spec_versions"
    ADD CONSTRAINT "course_spec_versions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "course_spec_versions"
    ADD CONSTRAINT "course_spec_versions_tenantId_academicCourseId_fkey"
    FOREIGN KEY ("tenantId", "academicCourseId") REFERENCES "academic_courses"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "course_spec_versions"
    ADD CONSTRAINT "course_spec_versions_tenantId_sourceId_fkey"
    FOREIGN KEY ("tenantId", "sourceId") REFERENCES "specification_sources"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "course_spec_versions"
    ADD CONSTRAINT "course_version_extraction_fk"
    FOREIGN KEY ("tenantId", "sourceId", "extractionId")
    REFERENCES "program_spec_extractions"("tenantId", "sourceId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "course_spec_versions"
    ADD CONSTRAINT "course_version_supersedes_fk"
    FOREIGN KEY ("tenantId", "academicCourseId", "supersedesId")
    REFERENCES "course_spec_versions"("tenantId", "academicCourseId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "course_spec_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_spec_versions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "course_spec_versions_tenant_isolation" ON "course_spec_versions"
    USING ("tenantId" = current_tenant_id())
    WITH CHECK ("tenantId" = current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON "course_spec_versions" TO mihwar_app;
