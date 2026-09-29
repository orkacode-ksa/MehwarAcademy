import { installArabicZodErrorMap } from "@mihwar/shared";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { assertRlsEffective } from "./lib/rlsGuard.js";
import { redis } from "./lib/redis.js";
import { claimOnce } from "./lib/leader.js";
import { closePdfEngine } from "./lib/pdf.js";
import { startTermCloser } from "./jobs/termCloser.js";
import { alertServerError } from "./lib/alerts.js";
import { bootstrapOwner } from "./modules/owner/staff.service.js";
import { migrateBlobsToObjectStorage } from "./modules/files/blobMigration.js";

installArabicZodErrorMap();

const app = createApp();

// يُفحص قبل قبول أي طلب: عزل المستأجرين يعتمد على RLS، وRLS تُتجاوَز صامتة بدور خارق.
// الفشل هنا مقصود — خادم يعمل بلا عزل أسوأ من خادم لا يعمل.
await assertRlsEffective();

const server = app.listen(env.PORT, () => {
  logger.info(`مِحوَر: الخادم يعمل على المنفذ ${env.PORT} — بيئة ${env.NODE_ENV}`);
});

startTermCloser();
// مهام الإقلاع تتولاها نسخة خادم واحدة حين تعمل أكثر من نسخة (تُقلعان معًا عند كل نشر).
// ينتظر اتصال Redis لحظة كي لا تفوز كل نسخة بالقفل لأن الاتصال لم يجهز بعد.
void (async () => {
  if (redis && redis.status !== "ready") await new Promise((r) => setTimeout(r, 3000));
  // استعادة حساب المالك من متغيرات Railway إن ضُبطت — مرة لكل قيمة، ولا تُسقط الخادم إن فشلت.
  if (await claimOnce("boot:owner", 120)) await bootstrapOwner().catch((err: unknown) => logger.error({ err }, "تعذّرت استعادة حساب المالك"));
  // ما خُزّن في قاعدة البيانات قبل ضبط التخزين الكائني يُنقل إليه في الخلفية (مرة، ويُكمل إن انقطع).
  if (await claimOnce("boot:blobs", 30 * 60))
    await migrateBlobsToObjectStorage().catch((err: unknown) => logger.error({ err }, "تعذّر نقل الملفات إلى التخزين الكائني — تبقى تُقرأ من القاعدة"));
})();

server.headersTimeout = 65_000;
server.requestTimeout = 60_000;

let shuttingDown = false;
async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`استلام ${signal} — بدء الإغلاق النظيف`);

  server.close(async () => {
    try {
      await prisma.$disconnect();
      await closePdfEngine();
      if (redis) await redis.quit();
      logger.info("تم الإغلاق النظيف بنجاح");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "خطأ أثناء الإغلاق");
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error("انتهت مهلة الإغلاق النظيف — إنهاء قسري");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandledRejection — إنهاء العملية");
  alertServerError(reason, { where: "انهيار العملية (unhandledRejection) — أُعيد تشغيل الخادم" });
  setTimeout(() => process.exit(1), 3000).unref();
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException — إنهاء العملية");
  alertServerError(err, { where: "انهيار العملية (uncaughtException) — أُعيد تشغيل الخادم" });
  setTimeout(() => process.exit(1), 3000).unref();
});
