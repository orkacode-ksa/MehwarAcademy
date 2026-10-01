-- مسح المنصة بطلب المالك: يُفرغ بيانات العملاء كلها ويُبقي حسابات الإدارة وإعداداتها.
--
-- دالة واحدة بصلاحية صاحبها (SECURITY DEFINER) لأن دور التطبيق لا يتجاوز RLS ولا يملك
-- تعطيل مُطلِقات سجل التدقيق — وهذا مقصود: الحذف الشامل لا يُنفَّذ إلا من هذه الدالة،
-- ولا تُستدعى إلا من خدمة تشترط المالك + كلمة مروره + عبارة تأكيد (wipe.service.ts).
--
-- p_keep_tenants: الجامعات التي تحوي حسابات الإدارة (تبقى كما هي مع مستخدميها).
-- p_wipe_audit:   يمسح سجل التدقيق أيضًا. بدونه يبقى السجل، وتفقد صفوف المحذوفين ربطها
--                 باسم صاحبها (userId ← NULL) دون مساس بمحتواها. التعطيل أدناه لمُطلِقات
--                 المستخدم فقط وداخل معاملة الدالة نفسها، فيعود مفعّلًا فور انتهائها.
CREATE OR REPLACE FUNCTION mihwar_wipe_platform(p_keep_tenants TEXT[], p_wipe_audit BOOLEAN)
RETURNS TABLE ("tenants" INTEGER, "users" INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n_tenants INTEGER;
  n_users INTEGER;
  t RECORD;
BEGIN
  IF p_keep_tenants IS NULL OR array_length(p_keep_tenants, 1) IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد جامعة الإدارة المحفوظة';
  END IF;

  ALTER TABLE "audit_logs" DISABLE TRIGGER USER;

  -- بيانات بلا مستأجر: كلها تخص العملاء
  DELETE FROM "orders";
  DELETE FROM "bank_courses";
  DELETE FROM "pending_signups";
  DELETE FROM "ai_usage";
  DELETE FROM "webhook_events";
  DELETE FROM "notifications";

  -- ما يمنع حذف المستأجر (RESTRICT) أولًا
  DELETE FROM "subscriptions" WHERE "tenantId" <> ALL (p_keep_tenants);
  DELETE FROM "workspaces" WHERE "tenantId" <> ALL (p_keep_tenants);

  -- كل جدول يحمل tenantId ولم تُزله التتالية (ملفات · محفظة · توليد · مصادر …):
  -- بحث ديناميكي لا قائمة يدوية، فلا يفوت المسحَ جدولٌ يُضاف لاحقًا.
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'tenantId'
      AND c.table_name NOT IN ('users', 'tenants', 'audit_logs', 'workspaces', 'subscriptions')
  LOOP
    EXECUTE format('DELETE FROM %I WHERE "tenantId" <> ALL ($1)', t.table_name) USING p_keep_tenants;
  END LOOP;

  WITH d AS (DELETE FROM "users" WHERE "tenantId" <> ALL (p_keep_tenants) RETURNING 1)
  SELECT COUNT(*)::int INTO n_users FROM d;

  WITH d AS (DELETE FROM "tenants" WHERE "id" <> ALL (p_keep_tenants) RETURNING 1)
  SELECT COUNT(*)::int INTO n_tenants FROM d;

  IF p_wipe_audit THEN
    DELETE FROM "audit_logs";
  END IF;

  ALTER TABLE "audit_logs" ENABLE TRIGGER USER;

  tenants := n_tenants;
  users := n_users;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION mihwar_wipe_platform(TEXT[], BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mihwar_wipe_platform(TEXT[], BOOLEAN) TO mihwar_app;
