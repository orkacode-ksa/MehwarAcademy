-- الساعات المكتبية: ساعات الأستاذ الأسبوعية وحجوزات طلابه.
CREATE TABLE "office_hours" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "slotMin" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "office_hours_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "office_hours_workspaceId_idx" ON "office_hours"("workspaceId");
CREATE INDEX "office_hours_tenantId_idx" ON "office_hours"("tenantId");

CREATE TABLE "office_bookings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "officeHourId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "topic" TEXT,
    "canceledAt" TIMESTAMP(3),
    "canceledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "office_bookings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "office_bookings_workspaceId_idx" ON "office_bookings"("workspaceId");
CREATE INDEX "office_bookings_studentId_idx" ON "office_bookings"("studentId");
CREATE INDEX "office_bookings_tenantId_idx" ON "office_bookings"("tenantId");
-- موعد واحد لا يُحجز مرتين (الملغى لا يحجز)
CREATE UNIQUE INDEX "office_bookings_slot_key" ON "office_bookings"("officeHourId", "date", "start") WHERE "canceledAt" IS NULL;

ALTER TABLE "office_bookings" ADD CONSTRAINT "office_bookings_officeHourId_fkey" FOREIGN KEY ("officeHourId") REFERENCES "office_hours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "office_bookings" ADD CONSTRAINT "office_bookings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "office_hours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "office_hours" FORCE ROW LEVEL SECURITY;
CREATE POLICY "office_hours_tenant_isolation" ON "office_hours"
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "office_hours" TO mihwar_app;

ALTER TABLE "office_bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "office_bookings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "office_bookings_tenant_isolation" ON "office_bookings"
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "office_bookings" TO mihwar_app;
