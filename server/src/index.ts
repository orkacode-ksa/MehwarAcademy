import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { closePdfEngine } from "./lib/pdf.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`مِحوَر: الخادم يعمل على المنفذ ${env.PORT} — بيئة ${env.NODE_ENV}`);
});

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
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException — إنهاء العملية");
  process.exit(1);
});
