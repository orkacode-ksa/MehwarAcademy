-- المتجر والبنك والتخزين والتوليد: الباقات · الحسابات البنكية · الطلبات والإيصالات · بنك المقررات
-- وجدول مؤلفيه · ربط Google · مرفقات بنود الملف · نموذج الإجابة · تقرير المقرر · النشاط العلمي.

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "answerKey" TEXT,
ADD COLUMN     "outcomes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "bankCourseId" TEXT,
ADD COLUMN     "report" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "file_assets" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'MATERIAL',
ADD COLUMN     "storage" TEXT NOT NULL DEFAULT 'R2';

-- AlterTable
ALTER TABLE "generation_jobs" ADD COLUMN     "engine" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "outputKind" TEXT,
ADD COLUMN     "resultLectureId" TEXT,
ADD COLUMN     "topicId" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "bankCoursesUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "planId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "profile" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "file_blobs" (
    "fileId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "file_blobs_pkey" PRIMARY KEY ("fileId")
);

-- CreateTable
CREATE TABLE "faculty_activities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "venue" TEXT,
    "date" DATE NOT NULL,
    "hours" INTEGER,
    "participation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faculty_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'TEACHER',
    "priceMonthly" DECIMAL(10,2) NOT NULL,
    "priceYearly" DECIMAL(10,2) NOT NULL,
    "maxCourses" INTEGER,
    "storageMb" INTEGER NOT NULL,
    "generationsPerMonth" INTEGER NOT NULL,
    "bankCoursesPerYear" INTEGER NOT NULL DEFAULT 0,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "accountNumber" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "planId" TEXT,
    "period" TEXT,
    "bankCourseId" TEXT,
    "titleAr" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "method" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "payerName" TEXT,
    "transferRef" TEXT,
    "transferDate" TIMESTAMP(3),
    "receiptMime" TEXT,
    "receiptName" TEXT,
    "receiptKey" TEXT,
    "receiptData" BYTEA,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_courses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "level" TEXT NOT NULL DEFAULT '',
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vipIncluded" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "content" JSONB NOT NULL,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "sourceCourseId" TEXT,
    "sourceTenantId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "importsCount" INTEGER NOT NULL DEFAULT 0,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_course_authors" (
    "id" TEXT NOT NULL,
    "bankCourseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "note" TEXT,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_course_authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_course_access" (
    "id" TEXT NOT NULL,
    "bankCourseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_course_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_connections" (
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_connections_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "file_blobs_tenantId_idx" ON "file_blobs"("tenantId");

-- CreateIndex
CREATE INDEX "faculty_activities_tenantId_idx" ON "faculty_activities"("tenantId");

-- CreateIndex
CREATE INDEX "faculty_activities_userId_idx" ON "faculty_activities"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE INDEX "orders_userId_idx" ON "orders"("userId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "bank_courses_status_specialization_idx" ON "bank_courses"("status", "specialization");

-- CreateIndex
CREATE INDEX "bank_course_authors_bankCourseId_idx" ON "bank_course_authors"("bankCourseId");

-- CreateIndex
CREATE INDEX "bank_course_authors_userId_idx" ON "bank_course_authors"("userId");

-- CreateIndex
CREATE INDEX "bank_course_access_userId_idx" ON "bank_course_access"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_course_access_bankCourseId_userId_key" ON "bank_course_access"("bankCourseId", "userId");

-- AddForeignKey
ALTER TABLE "file_blobs" ADD CONSTRAINT "file_blobs_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_course_authors" ADD CONSTRAINT "bank_course_authors_bankCourseId_fkey" FOREIGN KEY ("bankCourseId") REFERENCES "bank_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_course_access" ADD CONSTRAINT "bank_course_access_bankCourseId_fkey" FOREIGN KEY ("bankCourseId") REFERENCES "bank_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;



ALTER TABLE "quality_file_items" ADD COLUMN "fileIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ═══════════════ العزل للجداول الجديدة التابعة للمستأجر ═══════════════
ALTER TABLE "file_blobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "file_blobs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "file_blobs_tenant_isolation" ON "file_blobs"
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "faculty_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "faculty_activities" FORCE ROW LEVEL SECURITY;
CREATE POLICY "faculty_activities_tenant_isolation" ON "faculty_activities"
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());

-- جداول المتجر على مستوى المنصة (خارج العزل عمدًا — انظر tenantScope.ts).
GRANT SELECT, INSERT, UPDATE, DELETE ON "file_blobs", "faculty_activities", "plans", "bank_accounts", "orders",
  "bank_courses", "bank_course_authors", "bank_course_access", "google_connections" TO mihwar_app;

-- ═══════════════ لائحة افتراضية لكل جامعة بلا لائحة ═══════════════
-- جامعات الإصدار الأول أُنشئت قبل جدول اللوائح، فبقيت بلا بنود ملف ولا سياسة غياب.
-- الافتراضي هو لائحة أم القرى: بنود ملف المقرر الأحد عشر، والحرمان فوق ١٥٪ بلا عذر أو ٢٥٪
-- مع العذر (القاعدة التنفيذية للمادة ١٤)، وسلّم التقديرات بأسمائه.
INSERT INTO "regulations" ("id", "tenantId", "courseFileItems", "gradeScheme", "letterGrades", "absencePolicy", "terminology", "violationTypes", "performanceKpis", "updatedAt")
SELECT 'reg_' || t."id", t."id", '[{"key": "SPEC", "label": "توصيف المقرر", "required": true}, {"key": "CV", "label": "السيرة الذاتية", "required": true}, {"key": "MIDTERM_EXAM", "label": "الاختبار النصفي", "required": true}, {"key": "PRACTICAL_EXAM", "label": "الاختبار العملي", "required": true}, {"key": "FINAL_EXAM", "label": "الاختبار النهائي", "required": true}, {"key": "ANSWER_KEY", "label": "نموذج الإجابة", "required": true}, {"key": "EXAM_STANDARDS", "label": "تقرير عن مدى استيفاء اختبار المقرر للمعايير الاختبارية", "required": true}, {"key": "GRADE_STATS", "label": "الأعلى والأقل والدرجة المتوسطة", "required": true}, {"key": "STUDENT_SAMPLES", "label": "نموذج من أعمال الطلبة", "required": true}, {"key": "STUDENT_EVALUATION", "label": "نتائج تقييم الطلبة (من موقع العضو)", "required": true}, {"key": "COURSE_REPORT", "label": "تقرير المقرر", "required": true}]'::jsonb, '[{"key": "COURSEWORK", "label": "أعمال فصلية", "weight": 30}, {"key": "MIDTERM", "label": "اختبار نصفي", "weight": 30}, {"key": "FINAL", "label": "اختبار نهائي", "weight": 40}]'::jsonb, '[{"letter": "A+", "min": 95, "name": "ممتاز مرتفع"}, {"letter": "A", "min": 90, "name": "ممتاز"}, {"letter": "B+", "min": 85, "name": "جيد جداً مرتفع"}, {"letter": "B", "min": 80, "name": "جيد جداً"}, {"letter": "C+", "min": 75, "name": "جيد مرتفع"}, {"letter": "C", "min": 70, "name": "جيد"}, {"letter": "D+", "min": 65, "name": "مقبول مرتفع"}, {"letter": "D", "min": 60, "name": "مقبول"}, {"letter": "F", "min": 0, "name": "راسب"}]'::jsonb, '{"warnPercent": 10, "banPercent": 15, "banPercentWithExcused": 25}'::jsonb, '{}'::jsonb, '[{"key": "ABSENCE_BAN", "label": "حرمان بسبب الغياب", "severity": "HIGH", "action": "الحرمان من دخول الاختبار النهائي"}, {"key": "CHEATING", "label": "غش في اختبار", "severity": "HIGH", "action": "رصد صفر في الاختبار والرفع للقسم", "escalateAfter": 1}, {"key": "PLAGIARISM", "label": "انتحال في واجب أو بحث", "severity": "MEDIUM", "action": "رصد صفر في العمل", "escalateAfter": 2}, {"key": "MISCONDUCT", "label": "إخلال بنظام القاعة", "severity": "MEDIUM", "action": "إنذار كتابي", "escalateAfter": 3}, {"key": "LATE_SUBMISSION", "label": "تأخر في التسليم", "severity": "LOW", "action": "خصم حسب تقدير الأستاذ"}]'::jsonb, '[{"key": "SETUP", "weight": 25}, {"key": "QUALITY_FILE", "weight": 30}, {"key": "ATTENDANCE_LOGGED", "weight": 25}, {"key": "GRADES_ON_TIME", "weight": 20}]'::jsonb, now()
FROM "tenants" t
WHERE NOT EXISTS (SELECT 1 FROM "regulations" r WHERE r."tenantId" = t."id");

-- المقررات القائمة بلا نسخة بنود أو سياسة تأخذها من لائحة جامعتها.
UPDATE "courses" c SET "fileItems" = r."courseFileItems" FROM "regulations" r
  WHERE r."tenantId" = c."tenantId" AND c."fileItems" = '[]'::jsonb;
UPDATE "courses" c SET "absencePolicy" = r."absencePolicy" FROM "regulations" r
  WHERE r."tenantId" = c."tenantId" AND c."absencePolicy" = '{}'::jsonb;

-- ═══════════════ الباقات الافتراضية (يعدّلها المالك) ═══════════════
INSERT INTO "plans" ("id", "code", "nameAr", "audience", "priceMonthly", "priceYearly", "maxCourses", "storageMb", "generationsPerMonth", "bankCoursesPerYear", "features", "sortOrder", "updatedAt") VALUES
 ('plan_free',  'FREE',  'المجانية', 'TEACHER', 0,  0,   2,    1024,  0,  0, ARRAY['مقرران','١ جيجابايت','ملف المقرر PDF'], 0, now()),
 ('plan_basic', 'BASIC', 'الأساسية', 'TEACHER', 49, 490, NULL, 10240, 20, 0, ARRAY['مقررات بلا حد','١٠ جيجابايت','٢٠ توليدًا شهريًا'], 1, now()),
 ('plan_vip',   'VIP',   'VIP',      'TEACHER', 99, 990, NULL, 51200, 60, 5, ARRAY['مقررات بلا حد','٥٠ جيجابايت','٦٠ توليدًا شهريًا','٥ مقررات من البنك سنويًا'], 2, now())
ON CONFLICT ("code") DO NOTHING;
