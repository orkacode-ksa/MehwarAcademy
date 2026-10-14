-- Add independent course publication without changing legacy IDs or snapshots.
BEGIN;

CREATE TABLE "course_spec_publications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "projectionVersion" TEXT NOT NULL,
    "projectionHash" TEXT,
    "status" "SpecificationPublicationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    CONSTRAINT "course_spec_publications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "course_publication_projection_version" CHECK ("projectionVersion" ~ '[^[:space:]]'),
    CONSTRAINT "course_publication_projection_hash" CHECK ("projectionHash" IS NULL OR "projectionHash" ~ '[^[:space:]]'),
    CONSTRAINT "course_publication_actor" CHECK (
        "status" <> 'PUBLISHED' OR ("publishedById" IS NOT NULL AND "publishedAt" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "course_spec_publications_tenantId_id_key"
    ON "course_spec_publications"("tenantId", "id");
CREATE UNIQUE INDEX "course_spec_publications_tenantId_versionId_key"
    ON "course_spec_publications"("tenantId", "versionId");
CREATE UNIQUE INDEX "course_spec_publications_tenantId_versionId_id_key"
    ON "course_spec_publications"("tenantId", "versionId", "id");
CREATE INDEX "course_spec_publications_tenantId_status_idx"
    ON "course_spec_publications"("tenantId", "status");

ALTER TABLE "course_spec_publications" ADD CONSTRAINT "course_spec_publications_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "course_spec_publications" ADD CONSTRAINT "course_spec_publications_tenantId_versionId_fkey"
    FOREIGN KEY ("tenantId", "versionId") REFERENCES "course_spec_versions"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "course_spec_publications" ADD CONSTRAINT "course_publication_approval_fk"
    FOREIGN KEY ("tenantId", "versionId", "approvalId") REFERENCES "course_spec_approvals"("tenantId", "versionId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;
-- Match the existing platform reviewer/approver actor pattern.
ALTER TABLE "course_spec_publications" ADD CONSTRAINT "course_spec_publications_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "course_spec_publications" ADD CONSTRAINT "course_spec_publications_publishedById_fkey"
    FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TRIGGER course_publication_00_immutable
    BEFORE UPDATE OR DELETE ON "course_spec_publications"
    FOR EACH ROW EXECUTE FUNCTION mihwar_guard_spec_snapshot('status', 'PUBLISHED');

-- Exact approvals are immutable once approved; lock the decision during validation.
-- Missing/mismatched tuples remain the responsibility of the composite FK/RLS.
CREATE FUNCTION mihwar_validate_course_publication() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE approval_status "CourseSpecificationApprovalStatus";
BEGIN
    SELECT "status" INTO approval_status FROM "course_spec_approvals"
        WHERE "tenantId" = NEW."tenantId" AND "versionId" = NEW."versionId" AND "id" = NEW."approvalId" FOR SHARE;
    IF FOUND AND approval_status <> 'APPROVED' THEN
        RAISE EXCEPTION 'Course publication requires an APPROVED course approval' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER course_publication_approval_guard
    BEFORE INSERT OR UPDATE ON "course_spec_publications"
    FOR EACH ROW EXECUTE FUNCTION mihwar_validate_course_publication();

ALTER TABLE "course_templates"
    ALTER COLUMN "programSpecificationId" DROP NOT NULL,
    ALTER COLUMN "publicationId" DROP NOT NULL,
    ADD COLUMN "courseSpecificationVersionId" TEXT,
    ADD COLUMN "coursePublicationId" TEXT,
    ADD CONSTRAINT "course_template_single_publication_path" CHECK (
        ("programSpecificationId" IS NOT NULL AND "publicationId" IS NOT NULL
            AND "courseSpecificationVersionId" IS NULL AND "coursePublicationId" IS NULL)
        OR ("programSpecificationId" IS NULL AND "publicationId" IS NULL
            AND "courseSpecificationVersionId" IS NOT NULL AND "coursePublicationId" IS NOT NULL)
    );

-- Ordinary NULLS DISTINCT preserves any number of legacy templates per tenant.
CREATE UNIQUE INDEX "course_templates_tenantId_courseSpecificationVersionId_key"
    ON "course_templates"("tenantId", "courseSpecificationVersionId");
-- Supporting one-to-one key for the exact publication relation in Prisma.
CREATE UNIQUE INDEX "course_template_course_publication_key"
    ON "course_templates"("tenantId", "courseSpecificationVersionId", "coursePublicationId");

ALTER TABLE "course_templates" ADD CONSTRAINT "course_templates_tenantId_courseSpecificationVersionId_fkey"
    FOREIGN KEY ("tenantId", "courseSpecificationVersionId") REFERENCES "course_spec_versions"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "course_templates" ADD CONSTRAINT "course_template_course_publication_fk"
    FOREIGN KEY ("tenantId", "courseSpecificationVersionId", "coursePublicationId")
    REFERENCES "course_spec_publications"("tenantId", "versionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION mihwar_assert_course_publication_mutable(p_tenant_id TEXT, p_publication_id TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE publication_status "SpecificationPublicationStatus";
BEGIN
    IF p_publication_id IS NULL THEN RETURN; END IF;
    SELECT "status" INTO publication_status FROM "course_spec_publications"
        WHERE "tenantId" = p_tenant_id AND "id" = p_publication_id FOR SHARE;
    IF publication_status <> 'PENDING' THEN
        RAISE EXCEPTION 'Course templates and their topics are immutable unless course publication is PENDING' USING ERRCODE = '23514';
    END IF;
END; $$;

-- Build the new template/topics while PENDING, then freeze them on publication.
-- Legacy program-publication behavior remains unchanged.
CREATE OR REPLACE FUNCTION mihwar_guard_course_template() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE publication_status "SpecificationPublicationStatus";
BEGIN
    IF TG_OP <> 'INSERT' THEN
        PERFORM mihwar_assert_publication_mutable(OLD."tenantId", OLD."publicationId");
        PERFORM mihwar_assert_course_publication_mutable(OLD."tenantId", OLD."coursePublicationId");
    END IF;
    IF TG_OP <> 'DELETE' THEN
        PERFORM mihwar_assert_publication_mutable(NEW."tenantId", NEW."publicationId");
        IF NEW."coursePublicationId" IS NOT NULL THEN
            SELECT "status" INTO publication_status FROM "course_spec_publications"
                WHERE "tenantId" = NEW."tenantId" AND "versionId" = NEW."courseSpecificationVersionId"
                  AND "id" = NEW."coursePublicationId" FOR SHARE;
            IF FOUND AND publication_status <> 'PENDING' THEN
                RAISE EXCEPTION 'New course template requires a PENDING course publication' USING ERRCODE = '23514';
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN OLD;
END; $$;

-- Extend only the existing shared helper; topic model/table/trigger stay unchanged.
CREATE OR REPLACE FUNCTION mihwar_assert_template_topics_mutable(p_tenant_id TEXT, p_template_id TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE publication_id TEXT; course_publication_id TEXT;
BEGIN
    SELECT "publicationId", "coursePublicationId" INTO publication_id, course_publication_id
        FROM "course_templates" WHERE "tenantId" = p_tenant_id AND "id" = p_template_id FOR SHARE;
    PERFORM mihwar_assert_publication_mutable(p_tenant_id, publication_id);
    PERFORM mihwar_assert_course_publication_mutable(p_tenant_id, course_publication_id);
END; $$;

ALTER TABLE "course_spec_publications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_spec_publications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "course_spec_publications_tenant_isolation" ON "course_spec_publications"
    USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "course_spec_publications" TO mihwar_app;

COMMIT;
