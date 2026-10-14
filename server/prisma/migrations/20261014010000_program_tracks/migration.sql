-- Real optional program tracks only. name retains the official wording;
-- nameKey is supplied by the trusted application. No normalization or backfill.
CREATE TABLE "program_tracks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "nameAr" TEXT,
    "nameEn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "program_tracks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "program_tracks_tenantId_programId_idx"
    ON "program_tracks"("tenantId", "programId");

-- Prisma 5 cannot express partial unique indexes in schema.prisma.
CREATE UNIQUE INDEX "program_tracks_active_name_key"
    ON "program_tracks"("tenantId", "programId", "nameKey")
    WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "program_tracks_active_code_key"
    ON "program_tracks"("tenantId", "programId", "code")
    WHERE "code" IS NOT NULL AND "deletedAt" IS NULL;

ALTER TABLE "program_tracks"
    ADD CONSTRAINT "program_tracks_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "program_tracks"
    ADD CONSTRAINT "program_tracks_tenantId_programId_fkey"
    FOREIGN KEY ("tenantId", "programId") REFERENCES "programs"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "program_tracks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "program_tracks" FORCE ROW LEVEL SECURITY;

CREATE POLICY "program_tracks_tenant_isolation" ON "program_tracks"
    USING ("tenantId" = current_tenant_id())
    WITH CHECK ("tenantId" = current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON "program_tracks" TO mihwar_app;
