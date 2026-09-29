-- الجامعة مربوطة بمفتاحها في القائمة المقنّنة: مساحة واحدة لكل جامعة
ALTER TABLE "tenants" ADD COLUMN "catalogKey" TEXT;
CREATE UNIQUE INDEX "tenants_catalogKey_key" ON "tenants"("catalogKey");
