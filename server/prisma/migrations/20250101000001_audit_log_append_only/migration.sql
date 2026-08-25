-- الدستور الأمني §15: سجل التدقيق append-only مفروض تقنيًا لا أخلاقيًا.
-- يمنع أي UPDATE أو DELETE مباشر على audit_logs حتى من مستخدم القاعدة نفسه.
-- ملاحظة: ON DELETE SET NULL من users.id → audit_logs.userId يُنفَّذ كـ UPDATE داخلي
-- ويصطدم بهذا الـ trigger أيضًا؛ التصميم المقصود: لا يُحذف مستخدم حذفًا فعليًا أبدًا
-- (الحذف الناعم عبر deletedAt وحده)، فلا يصل هذا المسار للتنفيذ في التشغيل الطبيعي.

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs جدول append-only: التعديل والحذف ممنوعان';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
