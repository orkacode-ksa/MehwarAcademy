-- الخطوة ٣ ومعها أربعة إصلاحات بنيوية:
--
-- ١) بنود ملف المقرر: `quality_file_items.itemKey` كان قائمة ثابتة (enum) بمفاتيح لا تطابق
--    مفاتيح لائحة الجامعة (SPEC مقابل COURSE_SPECIFICATION) — فأي بند تضيفه جامعة لا يُحفظ.
--    صار نصًّا يشير إلى `courses.fileItems`، وهي نسخة من اللائحة عند إنشاء المقرر.
-- ٢) توصيف المقرر: `courses.spec`.
-- ٣) القواعد: سياسة الغياب تُنسخ للمقرر · أنواع المخالفات وأوزان تقييم الأداء في اللائحة.
-- ٤) محاضرة اليوم: مواعيد الشعبة · المحاضرات المعقودة · المخالفات.

-- ── ١: بنود الملف ─────────────────────────────────────────────
ALTER TABLE "quality_file_items" ALTER COLUMN "itemKey" TYPE TEXT USING "itemKey"::text;
UPDATE "quality_file_items" SET "itemKey" = CASE "itemKey"
  WHEN 'COURSE_SPECIFICATION' THEN 'SPEC'
  WHEN 'LEARNING_OUTCOMES_MAP' THEN 'OUTCOMES'
  WHEN 'LECTURE_ARCHIVE' THEN 'LECTURES'
  WHEN 'ATTENDANCE_RECORD' THEN 'ATTENDANCE'
  WHEN 'IMPROVEMENT_PLAN' THEN 'IMPROVEMENT'
  ELSE "itemKey" END;
-- الصفوف المُنشأة مسبقًا بلا تأشير لا معنى لها الآن (الحالة تُشتقّ)؛ نُبقي ما أشّره الأستاذ فقط.
DELETE FROM "quality_file_items" WHERE "completed" = false AND "note" IS NULL;
DROP TYPE "QualityItemKey";

-- ── ٢ و٣: المقرر ─────────────────────────────────────────────
ALTER TABLE "courses" ADD COLUMN "spec" JSONB NOT NULL DEFAULT '{}',
                      ADD COLUMN "fileItems" JSONB NOT NULL DEFAULT '[]',
                      ADD COLUMN "absencePolicy" JSONB NOT NULL DEFAULT '{}',
                      ADD COLUMN "clonedFromId" TEXT;

-- المقررات القائمة تأخذ نسختها من لائحة جامعتها الحالية.
UPDATE "courses" c SET "fileItems" = r."courseFileItems", "absencePolicy" = r."absencePolicy"
  FROM "regulations" r WHERE r."tenantId" = c."tenantId";

ALTER TABLE "regulations" ADD COLUMN "violationTypes" JSONB NOT NULL DEFAULT '[]',
                          ADD COLUMN "performanceKpis" JSONB NOT NULL DEFAULT '[]';

UPDATE "regulations" SET
  "violationTypes" = '[
    {"key":"ABSENCE_BAN","label":"حرمان بسبب الغياب","severity":"HIGH","action":"الحرمان من دخول الاختبار النهائي"},
    {"key":"CHEATING","label":"غش في اختبار","severity":"HIGH","action":"رصد صفر في الاختبار والرفع للقسم","escalateAfter":1},
    {"key":"PLAGIARISM","label":"انتحال في واجب","severity":"MEDIUM","action":"رصد صفر في الواجب","escalateAfter":2},
    {"key":"MISCONDUCT","label":"إخلال بنظام القاعة","severity":"MEDIUM","action":"إنذار كتابي","escalateAfter":3},
    {"key":"LATE_SUBMISSION","label":"تأخر في التسليم","severity":"LOW","action":"خصم حسب تقدير الأستاذ"}
  ]'::jsonb,
  "performanceKpis" = '[
    {"key":"SETUP","weight":25},
    {"key":"QUALITY_FILE","weight":30},
    {"key":"ATTENDANCE_LOGGED","weight":25},
    {"key":"GRADES_ON_TIME","weight":20}
  ]'::jsonb
WHERE "violationTypes" = '[]'::jsonb;

-- ── ٤: التدريس ───────────────────────────────────────────────
ALTER TABLE "sections" ADD COLUMN "meetings" JSONB NOT NULL DEFAULT '[]',
                       ADD COLUMN "joinCode" TEXT;
CREATE UNIQUE INDEX "sections_joinCode_key" ON "sections"("joinCode");

ALTER TABLE "lectures" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'TEXT',
                       ADD COLUMN "url" TEXT;

ALTER TABLE "assessments" ADD COLUMN "instructions" TEXT,
                          ADD COLUMN "dueDate" TIMESTAMP(3),
                          ADD COLUMN "isLab" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "class_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "topicId" TEXT,
    "date" DATE NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "class_sessions_workspaceId_idx" ON "class_sessions"("workspaceId");
CREATE INDEX "class_sessions_tenantId_idx" ON "class_sessions"("tenantId");
CREATE UNIQUE INDEX "class_sessions_sectionId_date_key" ON "class_sessions"("sectionId", "date");
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "violations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "typeKey" TEXT NOT NULL,
    "typeLabel" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "action" TEXT,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "violations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "violations_workspaceId_idx" ON "violations"("workspaceId");
CREATE INDEX "violations_courseId_idx" ON "violations"("courseId");
CREATE INDEX "violations_enrollmentId_idx" ON "violations"("enrollmentId");
CREATE INDEX "violations_tenantId_idx" ON "violations"("tenantId");
ALTER TABLE "violations" ADD CONSTRAINT "violations_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "violations" ADD CONSTRAINT "violations_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── العزل: الجداول الجديدة تحت RLS كغيرها ─────────────────────
ALTER TABLE "class_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "class_sessions_tenant_isolation" ON "class_sessions"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

ALTER TABLE "violations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "violations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "violations_tenant_isolation" ON "violations"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON "class_sessions", "violations" TO mihwar_app;

-- ── انضمام الطالب برمز الشعبة ─────────────────────────────────
-- الطالب يسجّل **قبل** أن يُعرف مستأجره، و`sections` تحت RLS فلا يراها بلا سياق.
-- دالة ضيّقة بصلاحية مالكها تُرجع مستأجر الشعبة ومعرّفها لرمز واحد فقط، ولا شيء غيرهما:
-- لا تعداد ولا قراءة أعمدة أخرى. هذا هو الاستثناء الوحيد، ومكتوب في tenantScope.ts.
CREATE OR REPLACE FUNCTION resolve_section_join_code(code TEXT)
RETURNS TABLE ("tenantId" TEXT, "sectionId" TEXT, "workspaceId" TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s."tenantId", s."id", s."workspaceId" FROM "sections" s
  WHERE s."joinCode" = code AND s."deletedAt" IS NULL
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION resolve_section_join_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_section_join_code(TEXT) TO mihwar_app;

-- ── انضمام الأستاذ برمز الجامعة ────────────────────────────────
-- كان التسجيل الذاتي يُنشئ مستأجرًا شخصيًا بلا لائحة ولا تقويم، فلا يجد الأستاذ فصلًا
-- يُنشئ فيه مقرره. الآن: المالك يعطي رمز الجامعة، والأستاذ يسجّل داخلها.
ALTER TABLE "tenants" ADD COLUMN "joinCode" TEXT;
CREATE UNIQUE INDEX "tenants_joinCode_key" ON "tenants"("joinCode");
UPDATE "tenants" SET "joinCode" = upper(substr(md5(random()::text || "id"), 1, 8)) WHERE "joinCode" IS NULL;
