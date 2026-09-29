-- لوحة الإدارة: أعداد مجمّعة عبر الجامعات دون قراءة صف واحد منها (لا أسماء ولا محتوى)،
-- فلا يلزم المرور على كل مستأجر، ولا تفتح الدالة بيانات جامعة لمن يستدعيها.
CREATE OR REPLACE FUNCTION mihwar_owner_pulse(p_trial_until TIMESTAMP)
RETURNS TABLE ("trialsEnding" INTEGER, "pendingSubmissions" INTEGER, "pendingUniversities" INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT COUNT(*)::int FROM "subscriptions" WHERE "status" = 'TRIALING' AND "trialEndsAt" IS NOT NULL AND "trialEndsAt" >= now() AND "trialEndsAt" <= p_trial_until),
    (SELECT COUNT(*)::int FROM "university_submissions" WHERE "status" = 'PENDING'),
    (SELECT COUNT(DISTINCT "tenantId")::int FROM "university_submissions" WHERE "status" = 'PENDING');
$$;
REVOKE ALL ON FUNCTION mihwar_owner_pulse(TIMESTAMP) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mihwar_owner_pulse(TIMESTAMP) TO mihwar_app;
