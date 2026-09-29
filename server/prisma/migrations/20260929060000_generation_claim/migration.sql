-- عامل التوليد المستقل يسحب المهام من الطابور عبر الجامعات: يحجز أقدم مهمة معلّقة ذرّيًا
-- (SKIP LOCKED — عاملان لا يأخذان المهمة نفسها أبدًا) ويعيد معرّفها وجامعتها فقط؛ التنفيذ
-- نفسه يجري بعدها داخل سياق الجامعة تحت RLS كالمعتاد.
CREATE OR REPLACE FUNCTION mihwar_claim_generation_job()
RETURNS TABLE ("id" TEXT, "tenantId" TEXT, "createdById" TEXT)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  UPDATE "generation_jobs" g SET "status" = 'RUNNING', "updatedAt" = now()
  WHERE g."id" = (
    SELECT j."id" FROM "generation_jobs" j
    WHERE j."status" = 'PENDING' AND j."topicId" IS NOT NULL
    ORDER BY j."createdAt"
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING g."id", g."tenantId", g."createdById";
$$;
REVOKE ALL ON FUNCTION mihwar_claim_generation_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mihwar_claim_generation_job() TO mihwar_app;
