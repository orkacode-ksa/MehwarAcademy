-- Academic course identity only. codeKey is supplied by the trusted application;
-- code retains its official spelling. No normalization or data backfill here.
CREATE TABLE "academic_courses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeKey" TEXT NOT NULL,
    "nameAr" TEXT,
    "nameEn" TEXT,
    "ownerDepartmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "academic_courses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_courses_tenantId_id_key"
    ON "academic_courses"("tenantId", "id");

CREATE INDEX "academic_courses_tenantId_codeKey_idx"
    ON "academic_courses"("tenantId", "codeKey");

CREATE INDEX "academic_courses_tenantId_ownerDepartmentId_idx"
    ON "academic_courses"("tenantId", "ownerDepartmentId");

-- Prisma 5 cannot express a partial unique index in schema.prisma.
-- Deleted identities may retain a codeKey; at most one active identity may use it.
CREATE UNIQUE INDEX "academic_courses_active_code_key"
    ON "academic_courses"("tenantId", "codeKey")
    WHERE "deletedAt" IS NULL;

ALTER TABLE "academic_courses"
    ADD CONSTRAINT "academic_courses_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "academic_courses"
    ADD CONSTRAINT "academic_courses_tenantId_ownerDepartmentId_fkey"
    FOREIGN KEY ("tenantId", "ownerDepartmentId")
    REFERENCES "departments"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "academic_courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic_courses" FORCE ROW LEVEL SECURITY;

CREATE POLICY "academic_courses_tenant_isolation" ON "academic_courses"
    USING ("tenantId" = current_tenant_id())
    WITH CHECK ("tenantId" = current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON "academic_courses" TO mihwar_app;
