-- موظفو الإدارة: الشاشات المسموحة لكل موظف (ADMIN) من لوحة المالك
ALTER TABLE "users" ADD COLUMN "staffScreens" TEXT[] DEFAULT ARRAY[]::TEXT[];
