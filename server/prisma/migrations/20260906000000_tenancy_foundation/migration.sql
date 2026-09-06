-- المرحلة ٧ — أساس التأجير.
--
-- ترتيب مقصود: الأعمدة تُضاف **قابلة للعدم** أولًا، ثم تُعبَّأ من البيانات القائمة، ثم
-- تُشدَّد إلى NOT NULL. مخرج `prisma migrate diff` يفعل العكس (NOT NULL بلا تعبئة) فيفشل
-- على أي جدول فيه صف واحد — ولذلك كُتبت هذه الهجرة يدويًا واختُبرت على قاعدة بها بيانات.
--
-- التعبئة تُنشئ مستأجرًا لكل مساحة عمل قائمة (التسجيل الذاتي = مستأجر لكل أستاذ)، ثم
-- تنسب المستخدمين عبر العضوية، ثم عبر التسجيل في الشُّعب، وما تبقّى يحصل على مستأجر خاص به.



CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "aiProvider" TEXT,
    "aiMonthlyBudgetUsd" DECIMAL(8,2) NOT NULL DEFAULT 25,
    "entitlements" JSONB NOT NULL DEFAULT '{}',
    "brandColor" TEXT,
    "brandLogoAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- ─────────────── ١) الأعمدة قابلة للعدم مؤقتًا ───────────────
ALTER TABLE "academic_years"     ADD COLUMN "tenantId" TEXT;
ALTER TABLE "assessments"        ADD COLUMN "tenantId" TEXT;
ALTER TABLE "attendance_records" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "audit_logs"         ADD COLUMN "tenantId" TEXT;
ALTER TABLE "courses"            ADD COLUMN "tenantId" TEXT;
ALTER TABLE "enrollments"        ADD COLUMN "tenantId" TEXT;
ALTER TABLE "file_assets"        ADD COLUMN "tenantId" TEXT;
ALTER TABLE "generation_jobs"    ADD COLUMN "tenantId" TEXT;
ALTER TABLE "grades"             ADD COLUMN "tenantId" TEXT;
ALTER TABLE "invoices"           ADD COLUMN "tenantId" TEXT;
ALTER TABLE "job_steps"          ADD COLUMN "tenantId" TEXT;
ALTER TABLE "lectures"           ADD COLUMN "tenantId" TEXT;
ALTER TABLE "payments"           ADD COLUMN "tenantId" TEXT;
ALTER TABLE "quality_file_items" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "sections"           ADD COLUMN "tenantId" TEXT;
ALTER TABLE "semesters"          ADD COLUMN "tenantId" TEXT;
ALTER TABLE "subscriptions"      ADD COLUMN "tenantId" TEXT;
ALTER TABLE "topics"             ADD COLUMN "tenantId" TEXT;
ALTER TABLE "users"              ADD COLUMN "tenantId" TEXT;
ALTER TABLE "workspace_members"  ADD COLUMN "tenantId" TEXT;
ALTER TABLE "workspaces"         ADD COLUMN "tenantId" TEXT, ADD COLUMN "departmentId" TEXT;

-- ─────────────── ٢) التعبئة ───────────────
-- مستأجر لكل مساحة عمل قائمة
INSERT INTO "tenants" ("id", "slug", "name", "status", "aiMonthlyBudgetUsd", "entitlements", "createdAt", "updatedAt")
SELECT 'tn' || w."id", 'w-' || w."id", w."name", 'ACTIVE', 25, '{}', w."createdAt", NOW()
FROM "workspaces" w;

UPDATE "workspaces" SET "tenantId" = 'tn' || "id";

-- المستخدمون: عبر العضوية أولًا، ثم عبر التسجيل في شعبة، ثم مستأجر خاص لمن تبقّى
UPDATE "users" u SET "tenantId" = w."tenantId"
FROM "workspace_members" m JOIN "workspaces" w ON w."id" = m."workspaceId"
WHERE m."userId" = u."id" AND u."tenantId" IS NULL;

UPDATE "users" u SET "tenantId" = e."tenantId"
FROM (SELECT DISTINCT en."studentId", w."tenantId"
      FROM "enrollments" en
      JOIN "sections" s ON s."id" = en."sectionId"
      JOIN "courses"  c ON c."id" = s."courseId"
      JOIN "workspaces" w ON w."id" = c."workspaceId") e
WHERE e."studentId" = u."id" AND u."tenantId" IS NULL;

INSERT INTO "tenants" ("id", "slug", "name", "status", "aiMonthlyBudgetUsd", "entitlements", "createdAt", "updatedAt")
SELECT 'tnu' || u."id", 'u-' || u."id", u."fullName", 'ACTIVE', 25, '{}', u."createdAt", NOW()
FROM "users" u WHERE u."tenantId" IS NULL;

UPDATE "users" SET "tenantId" = 'tnu' || "id" WHERE "tenantId" IS NULL;

-- الجداول التابعة: من مساحة العمل مباشرة
UPDATE "academic_years"    t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";
UPDATE "semesters"         t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";
UPDATE "courses"           t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";
UPDATE "sections"          t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";
UPDATE "enrollments"       t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";
UPDATE "topics"            t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";
UPDATE "lectures"          t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";
UPDATE "attendance_records" t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";
UPDATE "assessments"       t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";
UPDATE "grades"            t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";
UPDATE "quality_file_items" t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";
UPDATE "generation_jobs"   t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";
UPDATE "file_assets"       t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";
UPDATE "workspace_members" t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";
UPDATE "subscriptions"     t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";
UPDATE "invoices"          t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";
UPDATE "payments"          t SET "tenantId" = i."tenantId" FROM "invoices" i WHERE i."id" = t."invoiceId";
UPDATE "job_steps"         t SET "tenantId" = j."tenantId" FROM "generation_jobs" j WHERE j."id" = t."jobId";
UPDATE "audit_logs"        t SET "tenantId" = w."tenantId" FROM "workspaces" w WHERE w."id" = t."workspaceId";

-- ─────────────── ٣) التشديد إلى NOT NULL (audit_logs يبقى اختياريًا عمدًا) ───────────────
ALTER TABLE "academic_years"     ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "assessments"        ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "attendance_records" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "courses"            ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "enrollments"        ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "file_assets"        ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "generation_jobs"    ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "grades"             ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "invoices"           ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "job_steps"          ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "lectures"           ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "payments"           ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "quality_file_items" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "sections"           ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "semesters"          ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "subscriptions"      ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "topics"             ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "users"              ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "workspace_members"  ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "workspaces"         ALTER COLUMN "tenantId" SET NOT NULL;

-- ─────────────── ٤) الفهارس: البريد والهاتف يصيران فريدين داخل المستأجر ───────────────
DROP INDEX "users_email_key";
DROP INDEX "users_phone_key";
DROP INDEX "users_role_idx";

-- ─────────────── ٥) الفهارس والمفاتيح الأجنبية ───────────────
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE INDEX "tenants_status_idx" ON "tenants"("status");
CREATE INDEX "departments_tenantId_idx" ON "departments"("tenantId");
CREATE UNIQUE INDEX "departments_tenantId_code_key" ON "departments"("tenantId", "code");
CREATE INDEX "academic_years_tenantId_idx" ON "academic_years"("tenantId");
CREATE INDEX "assessments_tenantId_idx" ON "assessments"("tenantId");
CREATE INDEX "attendance_records_tenantId_idx" ON "attendance_records"("tenantId");
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");
CREATE INDEX "courses_tenantId_idx" ON "courses"("tenantId");
CREATE INDEX "enrollments_tenantId_idx" ON "enrollments"("tenantId");
CREATE INDEX "file_assets_tenantId_idx" ON "file_assets"("tenantId");
CREATE INDEX "generation_jobs_tenantId_idx" ON "generation_jobs"("tenantId");
CREATE INDEX "grades_tenantId_idx" ON "grades"("tenantId");
CREATE INDEX "invoices_tenantId_idx" ON "invoices"("tenantId");
CREATE INDEX "job_steps_tenantId_idx" ON "job_steps"("tenantId");
CREATE INDEX "lectures_tenantId_idx" ON "lectures"("tenantId");
CREATE INDEX "payments_tenantId_idx" ON "payments"("tenantId");
CREATE INDEX "quality_file_items_tenantId_idx" ON "quality_file_items"("tenantId");
CREATE INDEX "sections_tenantId_idx" ON "sections"("tenantId");
CREATE INDEX "semesters_tenantId_idx" ON "semesters"("tenantId");
CREATE INDEX "subscriptions_tenantId_idx" ON "subscriptions"("tenantId");
CREATE INDEX "topics_tenantId_idx" ON "topics"("tenantId");
CREATE INDEX "users_tenantId_role_idx" ON "users"("tenantId", "role");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");
CREATE UNIQUE INDEX "users_tenantId_phone_key" ON "users"("tenantId", "phone");
CREATE INDEX "workspace_members_tenantId_idx" ON "workspace_members"("tenantId");
CREATE INDEX "workspaces_tenantId_idx" ON "workspaces"("tenantId");
CREATE INDEX "workspaces_departmentId_idx" ON "workspaces"("departmentId");

ALTER TABLE "departments" ADD CONSTRAINT "departments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
