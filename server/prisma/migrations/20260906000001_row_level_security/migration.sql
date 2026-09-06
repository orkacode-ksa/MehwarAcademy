-- الجدار الثاني للعزل: Row Level Security.
--
-- الجدار الأول (امتداد Prisma) يحقن شرط المستأجر في كل استعلام. هذا الجدار يجعل الخطأ
-- البشري غير كافٍ: استعلام نسي شرطه — أو استعلام خام، أو أداة يقترحها نموذج ذكاء — لا
-- يستطيع مغادرة المستأجر لأن قاعدة البيانات نفسها ترفض الصفوف.
--
-- السياسة تقرأ `app.tenant_id` المضبوط بـ set_config(..., true) داخل المعاملة. الوسيط
-- `true` في current_setting يعني «أرجِع NULL إن لم يُضبط» بدل رمي خطأ — فتصير النتيجة
-- **صفر صفوف** لا تسريبًا. الفشل مغلق بالتصميم.
--
-- FORCE يجعل السياسة تسري حتى على مالك الجدول؛ بدونه يتجاوزها صاحب المخطّط بصمت.
--
-- خارج هذا الجدار عمدًا (ولكلٍّ سبب في src/lib/tenantScope.ts):
--   tenants · users · refresh_tokens · password_reset_tokens · audit_logs · webhook_events
-- المصادقة تسبق حسم المستأجر بطبيعتها، فلا يمكن أن تخضع لسياسة تعتمد عليه. عزل `users`
-- مفروض في طبقة التطبيق ويفحصه اختبار العزل — وترقيته لدور قاعدة بيانات منفصل مسجّلة
-- كدَين في docs/STATE.md.

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '');
$$ LANGUAGE sql STABLE;

ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "departments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "departments_tenant_isolation" ON "departments"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspaces" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workspaces_tenant_isolation" ON "workspaces"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "workspace_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_members" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workspace_members_tenant_isolation" ON "workspace_members"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_tenant_isolation" ON "subscriptions"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY "invoices_tenant_isolation" ON "invoices"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "payments_tenant_isolation" ON "payments"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "academic_years" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic_years" FORCE ROW LEVEL SECURITY;
CREATE POLICY "academic_years_tenant_isolation" ON "academic_years"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "semesters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "semesters" FORCE ROW LEVEL SECURITY;
CREATE POLICY "semesters_tenant_isolation" ON "semesters"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "courses" FORCE ROW LEVEL SECURITY;
CREATE POLICY "courses_tenant_isolation" ON "courses"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sections" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sections_tenant_isolation" ON "sections"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "enrollments_tenant_isolation" ON "enrollments"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "topics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "topics" FORCE ROW LEVEL SECURITY;
CREATE POLICY "topics_tenant_isolation" ON "topics"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "lectures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lectures" FORCE ROW LEVEL SECURITY;
CREATE POLICY "lectures_tenant_isolation" ON "lectures"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY "attendance_records_tenant_isolation" ON "attendance_records"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assessments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "assessments_tenant_isolation" ON "assessments"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "grades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grades" FORCE ROW LEVEL SECURITY;
CREATE POLICY "grades_tenant_isolation" ON "grades"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "quality_file_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quality_file_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY "quality_file_items_tenant_isolation" ON "quality_file_items"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "generation_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generation_jobs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "generation_jobs_tenant_isolation" ON "generation_jobs"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "job_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_steps" FORCE ROW LEVEL SECURITY;
CREATE POLICY "job_steps_tenant_isolation" ON "job_steps"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "file_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "file_assets" FORCE ROW LEVEL SECURITY;
CREATE POLICY "file_assets_tenant_isolation" ON "file_assets"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- ملاحظة تشغيلية: هجرات Prisma نفسها تعمل بلا `app.tenant_id`، فلو أضيفت لاحقًا هجرة
-- تكتب في هذه الجداول وجب أن تضبطه أو أن تعطّل السياسة داخل معاملتها. الأمان أولًا:
-- هجرة تفشل أوضح من هجرة تكتب في المستأجر الخطأ.


-- ─────────────── دور التطبيق ───────────────
-- **اكتُشف بالقياس لا بالافتراض:** المستخدم الخارق (superuser) يتجاوز RLS تجاوزًا كاملًا،
-- و`FORCE ROW LEVEL SECURITY` لا يمنعه — إنما يُلزم مالك الجدول وحده. فلو بقي التطبيق
-- متصلًا بالمستخدم الافتراضي للمنصة المستضيفة، لكانت كل السياسات أعلاه **ديكورًا**:
-- اختُبر ذلك فعليًا فكان كل مستأجر يرى صفوف الآخر رغم تفعيل السياسات.
--
-- لذلك: التطبيق يتصل بدور غير خارق، والخادم يرفض الإقلاع في الإنتاج إن كان الدور
-- المتصل خارقًا أو يحمل BYPASSRLS (انظر src/lib/rlsGuard.ts).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mihwar_app') THEN
    CREATE ROLE mihwar_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO mihwar_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mihwar_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mihwar_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mihwar_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO mihwar_app;

-- خطوة تشغيلية مطلوبة مرة واحدة لكل بيئة (لا تُكتب كلمة السر في هجرة داخل المستودع):
--   ALTER ROLE mihwar_app LOGIN PASSWORD '<من مدير الأسرار>';
-- ثم يُوجَّه DATABASE_URL لهذا الدور. الهجرات نفسها تبقى تعمل بالدور المالك.
