-- Curriculum membership is independent of academic course ownership.
-- No backfill; publish the table, constraints and RLS atomically.
BEGIN;

CREATE TYPE "CurriculumCourseRequirement" AS ENUM ('REQUIRED', 'ELECTIVE');

-- Supporting keys for exact optional parents; existing rows/data stay intact.
CREATE UNIQUE INDEX "curriculum_track_parent_key"
    ON "program_tracks"("tenantId", "programId", "id");
CREATE UNIQUE INDEX "curriculum_program_spec_parent_key"
    ON "program_specifications"("tenantId", "programId", "id");

CREATE TABLE "curriculum_courses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "programTrackId" TEXT,
    "programSpecificationId" TEXT,
    "academicCourseId" TEXT NOT NULL,
    "courseSpecificationVersionId" TEXT,
    "requirement" "CurriculumCourseRequirement",
    "level" TEXT,
    "year" TEXT,
    "orderIndex" INTEGER,
    "sourceId" TEXT,
    "sourcePages" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "curriculum_courses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "curriculum_course_nonnegative_order" CHECK ("orderIndex" IS NULL OR "orderIndex" >= 0),
    CONSTRAINT "curriculum_course_positive_source_pages" CHECK (
        array_position("sourcePages", NULL) IS NULL AND 0 < ALL ("sourcePages")
    )
);

CREATE UNIQUE INDEX "curriculum_courses_tenantId_id_key"
    ON "curriculum_courses"("tenantId", "id");

-- Four disjoint contexts avoid PostgreSQL's distinct-NULL unique semantics.
CREATE UNIQUE INDEX "curriculum_course_program_key"
    ON "curriculum_courses"("tenantId", "programId", "academicCourseId")
    WHERE "programTrackId" IS NULL AND "programSpecificationId" IS NULL;
CREATE UNIQUE INDEX "curriculum_course_track_key"
    ON "curriculum_courses"("tenantId", "programId", "programTrackId", "academicCourseId")
    WHERE "programTrackId" IS NOT NULL AND "programSpecificationId" IS NULL;
CREATE UNIQUE INDEX "curriculum_course_program_spec_key"
    ON "curriculum_courses"("tenantId", "programId", "programSpecificationId", "academicCourseId")
    WHERE "programTrackId" IS NULL AND "programSpecificationId" IS NOT NULL;
CREATE UNIQUE INDEX "curriculum_course_track_spec_key"
    ON "curriculum_courses"("tenantId", "programId", "programTrackId", "programSpecificationId", "academicCourseId")
    WHERE "programTrackId" IS NOT NULL AND "programSpecificationId" IS NOT NULL;

CREATE INDEX "curriculum_courses_tenantId_programId_idx"
    ON "curriculum_courses"("tenantId", "programId");
CREATE INDEX "curriculum_courses_tenantId_academicCourseId_idx"
    ON "curriculum_courses"("tenantId", "academicCourseId");
CREATE INDEX "curriculum_courses_tenantId_sourceId_idx"
    ON "curriculum_courses"("tenantId", "sourceId");

ALTER TABLE "curriculum_courses" ADD CONSTRAINT "curriculum_courses_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "curriculum_courses" ADD CONSTRAINT "curriculum_courses_tenantId_programId_fkey"
    FOREIGN KEY ("tenantId", "programId") REFERENCES "programs"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "curriculum_courses" ADD CONSTRAINT "curriculum_track_fk"
    FOREIGN KEY ("tenantId", "programId", "programTrackId")
    REFERENCES "program_tracks"("tenantId", "programId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "curriculum_courses" ADD CONSTRAINT "curriculum_program_spec_fk"
    FOREIGN KEY ("tenantId", "programId", "programSpecificationId")
    REFERENCES "program_specifications"("tenantId", "programId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "curriculum_courses" ADD CONSTRAINT "curriculum_courses_tenantId_academicCourseId_fkey"
    FOREIGN KEY ("tenantId", "academicCourseId") REFERENCES "academic_courses"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "curriculum_courses" ADD CONSTRAINT "curriculum_course_version_fk"
    FOREIGN KEY ("tenantId", "academicCourseId", "courseSpecificationVersionId")
    REFERENCES "course_spec_versions"("tenantId", "academicCourseId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "curriculum_courses" ADD CONSTRAINT "curriculum_courses_tenantId_sourceId_fkey"
    FOREIGN KEY ("tenantId", "sourceId") REFERENCES "specification_sources"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Reuse the publication guard's parent-row FOR SHARE pattern, but check only
-- ProgramSpecification.approvalStatus. Course approvals are not plan approvals.
CREATE FUNCTION mihwar_assert_curriculum_plan_mutable(p_tenant_id TEXT, p_specification_id TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE approval_status "SpecificationApprovalStatus";
BEGIN
    IF p_specification_id IS NULL THEN RETURN; END IF;
    SELECT "approvalStatus" INTO approval_status FROM "program_specifications"
        WHERE "tenantId" = p_tenant_id AND "id" = p_specification_id FOR SHARE;
    IF approval_status = 'APPROVED' THEN
        RAISE EXCEPTION 'Curriculum of an approved program specification is immutable' USING ERRCODE = '23514';
    END IF;
END; $$;

CREATE FUNCTION mihwar_guard_curriculum_course() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN
        PERFORM mihwar_assert_curriculum_plan_mutable(OLD."tenantId", OLD."programSpecificationId");
    END IF;
    IF TG_OP <> 'DELETE' THEN
        PERFORM mihwar_assert_curriculum_plan_mutable(NEW."tenantId", NEW."programSpecificationId");
        RETURN NEW;
    END IF;
    RETURN OLD;
END; $$;
CREATE TRIGGER curriculum_course_plan_immutable
    BEFORE INSERT OR UPDATE OR DELETE ON "curriculum_courses"
    FOR EACH ROW EXECUTE FUNCTION mihwar_guard_curriculum_course();

ALTER TABLE "curriculum_courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "curriculum_courses" FORCE ROW LEVEL SECURITY;
CREATE POLICY "curriculum_courses_tenant_isolation" ON "curriculum_courses"
    USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "curriculum_courses" TO mihwar_app;

COMMIT;
