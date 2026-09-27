-- AlterTable
ALTER TABLE "orders" ADD COLUMN "creditHalalas" INTEGER, ADD COLUMN "feeHalalas" INTEGER;
ALTER TABLE "generation_jobs" ADD COLUMN "paidBy" TEXT NOT NULL DEFAULT 'QUOTA',
ADD COLUMN "reservedHalalas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "chargedHalalas" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id"),
    -- الجدار الأخير: لا رصيد سالب مهما حدث في الشيفرة
    CONSTRAINT "wallets_balance_nonneg" CHECK ("balance" >= 0)
);
CREATE UNIQUE INDEX "wallets_workspaceId_key" ON "wallets"("workspaceId");
CREATE INDEX "wallets_tenantId_idx" ON "wallets"("tenantId");

CREATE TABLE "wallet_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "orderId" TEXT,
    "jobId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "wallet_entries_workspaceId_createdAt_idx" ON "wallet_entries"("workspaceId", "createdAt");
CREATE INDEX "wallet_entries_tenantId_idx" ON "wallet_entries"("tenantId");
-- الشحن يُقيَّد مرة واحدة لكل طلب، والحجز والردّ مرة لكل مهمة — ولو اعتُمد الطلب مرتين أو أُعيدت المهمة
CREATE UNIQUE INDEX "wallet_entries_topup_once" ON "wallet_entries"("orderId") WHERE "kind" = 'TOPUP';
CREATE UNIQUE INDEX "wallet_entries_job_once" ON "wallet_entries"("jobId", "kind") WHERE "jobId" IS NOT NULL;

-- الدفتر إضافة فقط: لا تعديل ولا حذف لقيد
CREATE OR REPLACE FUNCTION mihwar_wallet_entries_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'wallet_entries is append-only';
END;
$$;
CREATE TRIGGER wallet_entries_append_only BEFORE UPDATE OR DELETE ON "wallet_entries"
  FOR EACH ROW EXECUTE FUNCTION mihwar_wallet_entries_append_only();

ALTER TABLE "wallets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallets" FORCE ROW LEVEL SECURITY;
CREATE POLICY "wallets_tenant_isolation" ON "wallets"
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE ON "wallets" TO mihwar_app;

ALTER TABLE "wallet_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallet_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY "wallet_entries_tenant_isolation" ON "wallet_entries"
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT ON "wallet_entries" TO mihwar_app;

-- للمالك: مجموع أرصدة الأساتذة غير المستهلكة (مال مقبوض والتزام استخدام قائم) بلا مرور على الجامعات
CREATE OR REPLACE FUNCTION mihwar_wallet_liability()
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM("balance"), 0)::bigint FROM "wallets";
$$;
REVOKE ALL ON FUNCTION mihwar_wallet_liability() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mihwar_wallet_liability() TO mihwar_app;

-- للمالك: متوسط التكلفة الفعلية وأعلاها لكل نوع مادة — به يضبط التقدير المحجوز من الرصيد
CREATE OR REPLACE FUNCTION mihwar_generation_cost_by_kind(p_since TIMESTAMP)
RETURNS TABLE ("kind" TEXT, "n" INTEGER, "avgSar" DOUBLE PRECISION, "maxSar" DOUBLE PRECISION)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "outputKind", COUNT(*)::int, AVG("actualCostRiyals")::float8, MAX("actualCostRiyals")::float8
  FROM "generation_jobs" WHERE "status" = 'SUCCEEDED' AND "createdAt" >= p_since AND "outputKind" IS NOT NULL
  GROUP BY "outputKind";
$$;
REVOKE ALL ON FUNCTION mihwar_generation_cost_by_kind(TIMESTAMP) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mihwar_generation_cost_by_kind(TIMESTAMP) TO mihwar_app;
