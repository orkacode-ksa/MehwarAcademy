-- Independent course reviews only. Keep legacy review flows and snapshots intact.
-- Publish the new table, RLS and the circular current-review FK atomically.
BEGIN;

CREATE TABLE "course_spec_reviews" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "SpecificationReviewStatus" NOT NULL DEFAULT 'IN_REVIEW',
    "schemaVersion" TEXT NOT NULL DEFAULT 'course-specification-1',
    "readinessPolicyVersion" TEXT NOT NULL DEFAULT 'course-readiness-1',
    "readinessReport" JSONB NOT NULL DEFAULT '{}',
    "draftData" JSONB NOT NULL,
    "reviewedData" JSONB,
    "contentHash" TEXT,
    "sourcePages" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "originSourceReviewId" TEXT,
    "originData" JSONB,
    "originSnapshotHash" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_spec_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "course_review_positive_revision" CHECK ("revision" > 0),
    CONSTRAINT "course_review_positive_source_pages" CHECK (
        array_position("sourcePages", NULL) IS NULL AND 0 < ALL ("sourcePages")
    ),
    -- As with legacy reviews, completion fixes a snapshot, its hash, actor and time.
    CONSTRAINT "course_review_completed_snapshot" CHECK (
        "status" <> 'COMPLETED' OR (
            "reviewedData" IS NOT NULL AND "reviewedData" <> 'null'::jsonb
            AND "contentHash" IS NOT NULL AND "contentHash" ~ '[^[:space:]]'
            AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL
        )
    )
);

CREATE UNIQUE INDEX "course_spec_reviews_tenantId_versionId_id_key"
    ON "course_spec_reviews"("tenantId", "versionId", "id");

CREATE UNIQUE INDEX "course_spec_reviews_tenantId_versionId_revision_key"
    ON "course_spec_reviews"("tenantId", "versionId", "revision");

-- COMPLETED is the only terminal review status in the existing enum.
CREATE UNIQUE INDEX "course_spec_reviews_active_version_key"
    ON "course_spec_reviews"("tenantId", "versionId")
    WHERE "status" IN ('NOT_STARTED', 'IN_REVIEW', 'CHANGES_REQUESTED');

CREATE INDEX "course_spec_reviews_tenantId_sourceId_idx"
    ON "course_spec_reviews"("tenantId", "sourceId");

CREATE INDEX "course_spec_reviews_tenantId_status_idx"
    ON "course_spec_reviews"("tenantId", "status");

ALTER TABLE "course_spec_reviews"
    ADD CONSTRAINT "course_spec_reviews_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "course_spec_reviews"
    ADD CONSTRAINT "course_spec_reviews_tenantId_sourceId_fkey"
    FOREIGN KEY ("tenantId", "sourceId") REFERENCES "specification_sources"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "course_spec_reviews"
    ADD CONSTRAINT "course_review_version_fk"
    FOREIGN KEY ("tenantId", "sourceId", "versionId")
    REFERENCES "course_spec_versions"("tenantId", "sourceId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "course_spec_reviews"
    ADD CONSTRAINT "course_review_origin_fk"
    FOREIGN KEY ("tenantId", "sourceId", "originSourceReviewId")
    REFERENCES "program_spec_reviews"("tenantId", "sourceId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Platform reviewers may belong to another tenant. Authorization stays in the capability layer.
ALTER TABLE "course_spec_reviews"
    ADD CONSTRAINT "course_spec_reviews_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "course_spec_versions" ADD COLUMN "currentReviewId" TEXT;

CREATE UNIQUE INDEX "course_version_current_review_key"
    ON "course_spec_versions"("tenantId", "id", "currentReviewId");

ALTER TABLE "course_spec_versions"
    ADD CONSTRAINT "course_version_current_review_fk"
    FOREIGN KEY ("tenantId", "id", "currentReviewId")
    REFERENCES "course_spec_reviews"("tenantId", "versionId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Reuse the existing completed-review immutability guard; drafts remain editable.
CREATE TRIGGER course_spec_review_immutable
    BEFORE UPDATE OR DELETE ON "course_spec_reviews"
    FOR EACH ROW EXECUTE FUNCTION mihwar_guard_spec_snapshot('status', 'COMPLETED');

ALTER TABLE "course_spec_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_spec_reviews" FORCE ROW LEVEL SECURITY;

CREATE POLICY "course_spec_reviews_tenant_isolation" ON "course_spec_reviews"
    USING ("tenantId" = current_tenant_id())
    WITH CHECK ("tenantId" = current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON "course_spec_reviews" TO mihwar_app;

COMMIT;
