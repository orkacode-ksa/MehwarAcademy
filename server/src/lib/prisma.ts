import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

/**
 * نسخة Prisma Client الوحيدة في العملية — لا تُنشئ نسخة ثانية أبدًا.
 * الحذف الناعم يُطبَّق بفلتر `deletedAt: null` صريح في كل استعلام بطبقة الـ service —
 * قصدًا لا عبر امتداد عام صامت: `count`/`aggregate`/`groupBy` لا يغطيها أي امتداد
 * findMany/findFirst، وفلتر صريح على منطق حساس بالعزل الأمني أوضح للمراجعة من سحر ضمني.
 */
export const prisma: PrismaClient =
  globalThis.__prisma__ ??
  new PrismaClient({
    log: env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (env.NODE_ENV !== "production") {
  globalThis.__prisma__ = prisma;
}
