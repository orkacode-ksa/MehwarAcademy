-- Independent course decisions. Leave legacy program approval/publication flows intact.
BEGIN;

CREATE TYPE "CourseSpecificationApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED');

CREATE TABLE "course_spec_approval_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "notes" TEXT,
    CONSTRAINT "course_spec_approval_batches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "course_approval_batch_request_key" CHECK ("requestKey" ~ '[^[:space:]]'),
    CONSTRAINT "course_approval_batch_manifest_hash" CHECK ("manifestHash" ~ '[^[:space:]]')
);

CREATE TABLE "course_spec_approvals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" "CourseSpecificationApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "readinessExceptions" JSONB NOT NULL DEFAULT '[]',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "course_spec_approvals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "course_approval_content_hash" CHECK ("contentHash" ~ '[^[:space:]]'),
    CONSTRAINT "course_approval_decision_fields" CHECK (
        ("status" = 'PENDING' AND "decidedById" IS NULL AND "decidedAt" IS NULL)
        OR ("status" IN ('APPROVED', 'REJECTED', 'CANCELED') AND "decidedById" IS NOT NULL AND "decidedAt" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "course_spec_approval_batches_tenantId_id_key"
    ON "course_spec_approval_batches"("tenantId", "id");
CREATE UNIQUE INDEX "course_spec_approval_batches_tenantId_requestKey_key"
    ON "course_spec_approval_batches"("tenantId", "requestKey");
CREATE INDEX "course_spec_approval_batches_tenantId_requestedAt_idx"
    ON "course_spec_approval_batches"("tenantId", "requestedAt");

CREATE UNIQUE INDEX "course_spec_approvals_tenantId_id_key"
    ON "course_spec_approvals"("tenantId", "id");
CREATE UNIQUE INDEX "course_spec_approvals_tenantId_versionId_id_key"
    ON "course_spec_approvals"("tenantId", "versionId", "id");
CREATE UNIQUE INDEX "course_spec_approvals_tenantId_batchId_versionId_key"
    ON "course_spec_approvals"("tenantId", "batchId", "versionId");

-- Rejected/canceled history does not consume either slot. Retry uses a new batch.
CREATE UNIQUE INDEX "course_spec_approvals_pending_version_key"
    ON "course_spec_approvals"("tenantId", "versionId") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "course_spec_approvals_approved_version_key"
    ON "course_spec_approvals"("tenantId", "versionId") WHERE "status" = 'APPROVED';
-- Backstop the state guard across all transaction isolation levels, including
-- stale repeatable-read snapshots and multi-row statements.
CREATE UNIQUE INDEX "course_spec_approvals_open_or_approved_version_key"
    ON "course_spec_approvals"("tenantId", "versionId") WHERE "status" IN ('PENDING', 'APPROVED');

CREATE INDEX "course_spec_approvals_tenantId_versionId_createdAt_idx"
    ON "course_spec_approvals"("tenantId", "versionId", "createdAt");
CREATE INDEX "course_spec_approvals_tenantId_status_idx"
    ON "course_spec_approvals"("tenantId", "status");

CREATE UNIQUE INDEX "course_review_approval_snapshot_key"
    ON "course_spec_reviews"("tenantId", "versionId", "id", "contentHash");

ALTER TABLE "course_spec_approval_batches" ADD CONSTRAINT "course_spec_approval_batches_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
-- As with course review actors, platform staff may belong to another tenant.
ALTER TABLE "course_spec_approval_batches" ADD CONSTRAINT "course_spec_approval_batches_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "course_spec_approvals" ADD CONSTRAINT "course_spec_approvals_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "course_spec_approvals" ADD CONSTRAINT "course_spec_approvals_tenantId_batchId_fkey"
    FOREIGN KEY ("tenantId", "batchId") REFERENCES "course_spec_approval_batches"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "course_spec_approvals" ADD CONSTRAINT "course_spec_approvals_tenantId_versionId_fkey"
    FOREIGN KEY ("tenantId", "versionId") REFERENCES "course_spec_versions"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "course_spec_approvals" ADD CONSTRAINT "course_approval_review_snapshot_fk"
    FOREIGN KEY ("tenantId", "versionId", "reviewId", "contentHash")
    REFERENCES "course_spec_reviews"("tenantId", "versionId", "id", "contentHash")
    ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "course_spec_approvals" ADD CONSTRAINT "course_spec_approvals_decidedById_fkey"
    FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "course_spec_versions" ADD COLUMN "currentApprovalId" TEXT;
CREATE UNIQUE INDEX "course_version_current_approval_key"
    ON "course_spec_versions"("tenantId", "id", "currentApprovalId");
ALTER TABLE "course_spec_versions" ADD CONSTRAINT "course_version_current_approval_fk"
    FOREIGN KEY ("tenantId", "id", "currentApprovalId")
    REFERENCES "course_spec_approvals"("tenantId", "versionId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Use the existing final-decision snapshot guard. Pending decisions remain editable.
CREATE TRIGGER course_approval_00_immutable
    BEFORE UPDATE OR DELETE ON "course_spec_approvals"
    FOR EACH ROW EXECUTE FUNCTION mihwar_guard_spec_snapshot('status', 'APPROVED,REJECTED,CANCELED');

-- Serialize live decisions on their common version row, following the existing
-- parent-row locking pattern. NO KEY UPDATE remains compatible with FK locks.
CREATE FUNCTION mihwar_guard_course_approval_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."status" NOT IN ('PENDING', 'APPROVED') THEN RETURN NEW; END IF;
    PERFORM 1 FROM "course_spec_versions"
        WHERE "tenantId" = NEW."tenantId" AND "id" = NEW."versionId" FOR NO KEY UPDATE;
    -- Let the existing FK/RLS reject missing or inaccessible versions.
    IF NOT FOUND THEN RETURN NEW; END IF;
    IF EXISTS (
        SELECT 1 FROM "course_spec_approvals"
        WHERE "tenantId" = NEW."tenantId" AND "versionId" = NEW."versionId" AND "id" <> NEW."id"
          AND ((NEW."status" = 'PENDING' AND "status" = 'APPROVED')
            OR (NEW."status" = 'APPROVED' AND "status" = 'PENDING'))
    ) THEN
        RAISE EXCEPTION 'APPROVED and PENDING course approvals cannot coexist for the same version'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER course_approval_state_guard
    BEFORE INSERT OR UPDATE ON "course_spec_approvals"
    FOR EACH ROW EXECUTE FUNCTION mihwar_guard_course_approval_state();

-- Follow existing approval validation; readiness policies stay in the service layer.
-- Missing/mismatched tuples are rejected by the exact composite FK, not this guard.
CREATE FUNCTION mihwar_validate_course_approval_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE review_status "SpecificationReviewStatus";
BEGIN
    SELECT "status" INTO review_status FROM "course_spec_reviews"
        WHERE "tenantId" = NEW."tenantId" AND "versionId" = NEW."versionId"
          AND "id" = NEW."reviewId" AND "contentHash" = NEW."contentHash"
        FOR SHARE;
    IF FOUND AND review_status <> 'COMPLETED' THEN
        RAISE EXCEPTION 'Course approval requires a completed review' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER course_approval_review_guard
    BEFORE INSERT OR UPDATE ON "course_spec_approvals"
    FOR EACH ROW EXECUTE FUNCTION mihwar_validate_course_approval_review();

-- Follow the existing publication-row FOR SHARE pattern: membership edits and
-- submission serialize on the batch row. All functions use invoker privileges/RLS.
CREATE FUNCTION mihwar_assert_course_approval_batch_mutable(p_tenant_id TEXT, p_batch_id TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE submitted_at TIMESTAMP(3);
BEGIN
    SELECT "submittedAt" INTO submitted_at FROM "course_spec_approval_batches"
        WHERE "tenantId" = p_tenant_id AND "id" = p_batch_id FOR SHARE;
    IF submitted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Submitted course approval batch manifest is immutable' USING ERRCODE = '23514';
    END IF;
END; $$;

CREATE FUNCTION mihwar_guard_course_approval_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    -- Decisions, exceptions and notes may change until the item becomes terminal.
    IF TG_OP = 'UPDATE' THEN
        IF ROW(OLD."id", OLD."tenantId", OLD."batchId", OLD."versionId", OLD."reviewId", OLD."contentHash", OLD."createdAt")
            IS NOT DISTINCT FROM
           ROW(NEW."id", NEW."tenantId", NEW."batchId", NEW."versionId", NEW."reviewId", NEW."contentHash", NEW."createdAt") THEN
            RETURN NEW;
        END IF;
    END IF;
    IF TG_OP <> 'INSERT' THEN
        PERFORM mihwar_assert_course_approval_batch_mutable(OLD."tenantId", OLD."batchId");
    END IF;
    IF TG_OP <> 'DELETE' THEN
        PERFORM mihwar_assert_course_approval_batch_mutable(NEW."tenantId", NEW."batchId");
        RETURN NEW;
    END IF;
    RETURN OLD;
END; $$;
CREATE TRIGGER course_approval_manifest_guard
    BEFORE INSERT OR UPDATE OR DELETE ON "course_spec_approvals"
    FOR EACH ROW EXECUTE FUNCTION mihwar_guard_course_approval_membership();

-- A sealed header cannot be changed/unsealed/deleted to bypass membership locks.
CREATE FUNCTION mihwar_guard_submitted_course_approval_batch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD."submittedAt" IS NOT NULL THEN
        RAISE EXCEPTION 'Submitted course approval batch is immutable' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER course_approval_batch_immutable
    BEFORE UPDATE OR DELETE ON "course_spec_approval_batches"
    FOR EACH ROW EXECUTE FUNCTION mihwar_guard_submitted_course_approval_batch();

ALTER TABLE "course_spec_approval_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_spec_approval_batches" FORCE ROW LEVEL SECURITY;
CREATE POLICY "course_spec_approval_batches_tenant_isolation" ON "course_spec_approval_batches"
    USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "course_spec_approval_batches" TO mihwar_app;

ALTER TABLE "course_spec_approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_spec_approvals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "course_spec_approvals_tenant_isolation" ON "course_spec_approvals"
    USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "course_spec_approvals" TO mihwar_app;

COMMIT;
