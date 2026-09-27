-- رئيس القسم: علَم على حساب الأستاذ يمنحه عرض القسم للقراءة، ويُسنده المالك.
-- علَم لا دور مستقل — تحويله إلى دور كان سيُسقط عنه شاشات تدريسه.
ALTER TABLE "users" ADD COLUMN "isDeptHead" BOOLEAN NOT NULL DEFAULT false;
