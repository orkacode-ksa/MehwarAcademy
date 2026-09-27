-- AlterTable
ALTER TABLE "users" ADD COLUMN "prefs" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "avatarFileId" TEXT,
ADD COLUMN "notifSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");
CREATE INDEX "notifications_tenantId_idx" ON "notifications"("tenantId");

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "notifications_tenant_isolation" ON "notifications"
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "notifications" TO mihwar_app;

-- ── مهام دورية عبر الجامعات بلا المرور على كل جامعة ─────────────────
-- كانت المهمة الساعية تفتح معاملة لكل مستأجر (ومع المستأجرين الشخصيين قد يبلغون عشرات الآلاف).
-- هذه الدوال تُرجع المعرّفات اللازمة فقط، والعمل نفسه يجري بعدها في سياق كل جامعة (RLS).
CREATE OR REPLACE FUNCTION mihwar_due_terms(p_cutoff TIMESTAMP)
RETURNS TABLE ("tenantId" TEXT, "id" TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s."tenantId", s."id" FROM "semesters" s
  WHERE s."status" IN ('ACTIVE', 'GRADING') AND s."endDate" < p_cutoff AND s."deletedAt" IS NULL;
$$;
REVOKE ALL ON FUNCTION mihwar_due_terms(TIMESTAMP) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mihwar_due_terms(TIMESTAMP) TO mihwar_app;

CREATE OR REPLACE FUNCTION mihwar_trials_ending(p_from TIMESTAMP, p_to TIMESTAMP)
RETURNS TABLE ("tenantId" TEXT, "userId" TEXT, "trialEndsAt" TIMESTAMP)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s."tenantId", w."ownerId", s."trialEndsAt" FROM "subscriptions" s
  JOIN "workspaces" w ON w."id" = s."workspaceId" AND w."deletedAt" IS NULL
  WHERE s."status" = 'TRIALING' AND s."trialEndsAt" >= p_from AND s."trialEndsAt" < p_to;
$$;
REVOKE ALL ON FUNCTION mihwar_trials_ending(TIMESTAMP, TIMESTAMP) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mihwar_trials_ending(TIMESTAMP, TIMESTAMP) TO mihwar_app;

-- جامعات معتمدة ليس فيها فصل مفتوح: أساتذتها لا يستطيعون إضافة مقرر حتى يفتح المالك فصلًا.
CREATE OR REPLACE FUNCTION mihwar_listed_without_term()
RETURNS TABLE ("tenantId" TEXT, "name" TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t."id", t."name" FROM "tenants" t
  WHERE t."listed" AND t."deletedAt" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "semesters" s WHERE s."tenantId" = t."id" AND s."deletedAt" IS NULL AND s."status" IN ('PREP', 'ACTIVE'));
$$;
REVOKE ALL ON FUNCTION mihwar_listed_without_term() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mihwar_listed_without_term() TO mihwar_app;

-- الإشعارات القديمة تُحذف (٩٠ يومًا) بلا مرور على الجامعات.
CREATE OR REPLACE FUNCTION mihwar_prune_notifications(p_before TIMESTAMP)
RETURNS INTEGER
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (DELETE FROM "notifications" WHERE "createdAt" < p_before RETURNING 1) SELECT count(*)::int FROM d;
$$;
REVOKE ALL ON FUNCTION mihwar_prune_notifications(TIMESTAMP) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mihwar_prune_notifications(TIMESTAMP) TO mihwar_app;
