-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "listed" BOOLEAN NOT NULL DEFAULT false;


-- لا يظهر في قائمة التسجيل العامة إلا ما يعتمده المالك: المساحات الشخصية القديمة كانت «نشطة»
-- فظهرت بأسماء أساتذتها. تبدأ كلها مخفية، والمالك يُظهر الجامعات الحقيقية من شاشته.
UPDATE "tenants" SET "listed" = false;
