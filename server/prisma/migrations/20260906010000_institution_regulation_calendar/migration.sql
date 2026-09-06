-- الخطوة ٠ — الجامعة ولائحتها وتقويمها.
--
-- ثلاثة تغييرات بنيوية:
-- ١) السنة الأكاديمية والفصل انتقلا من مساحة عمل الأستاذ إلى الجامعة. كان كل أستاذ
--    يخترع تقويمه الخاص، وهو ما يجعل «محاضرة اليوم» و«قفل الرصد» مستحيلين.
-- ٢) جدول `regulations`: لائحة كل جامعة (بنود ملف المقرر · التوزيع · سياسة الغياب ·
--    المصطلحات). المنصة لا تفرض معيارًا — المالك يعرّف والمنصة تنفّذ.
-- ٣) حالة الفصل و`holidays`: الحالة تحكم ما يستطيع الأستاذ فعله، والإجازات تُستثنى
--    من حسابات الغياب.

-- CreateEnum
CREATE TYPE "TermStatus" AS ENUM ('PREP', 'ACTIVE', 'GRADING', 'CLOSED', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "academic_years" DROP CONSTRAINT "academic_years_workspaceId_fkey";

-- DropIndex
DROP INDEX "academic_years_workspaceId_idx";

-- DropIndex
DROP INDEX "semesters_tenantId_idx";

-- DropIndex
DROP INDEX "semesters_workspaceId_idx";

-- AlterTable
ALTER TABLE "academic_years" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "semesters" DROP COLUMN "workspaceId",
ADD COLUMN     "gradeLockAt" TIMESTAMP(3),
ADD COLUMN     "status" "TermStatus" NOT NULL DEFAULT 'PREP';

-- CreateTable
CREATE TABLE "regulations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courseFileItems" JSONB NOT NULL DEFAULT '[]',
    "gradeScheme" JSONB NOT NULL DEFAULT '[]',
    "letterGrades" JSONB NOT NULL DEFAULT '[]',
    "absencePolicy" JSONB NOT NULL DEFAULT '{}',
    "terminology" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'HOLIDAY',

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regulations_tenantId_key" ON "regulations"("tenantId");

-- CreateIndex
CREATE INDEX "holidays_tenantId_idx" ON "holidays"("tenantId");

-- CreateIndex
CREATE INDEX "holidays_semesterId_idx" ON "holidays"("semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_tenantId_label_key" ON "academic_years"("tenantId", "label");

-- CreateIndex
CREATE INDEX "semesters_tenantId_status_idx" ON "semesters"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "regulations" ADD CONSTRAINT "regulations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- إسقاط العمود المتبقّي صراحةً: مخرج diff اكتفى بجعله قابلًا للعدم.
ALTER TABLE "academic_years" DROP COLUMN IF EXISTS "workspaceId";

-- RLS للجدولين الجديدين — الجدار الثاني يسري عليهما كغيرهما.
ALTER TABLE "regulations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "regulations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "regulations_tenant_isolation" ON "regulations"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "holidays" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "holidays" FORCE ROW LEVEL SECURITY;
CREATE POLICY "holidays_tenant_isolation" ON "holidays"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON "regulations", "holidays" TO mihwar_app;
