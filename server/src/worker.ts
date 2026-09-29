import { installArabicZodErrorMap } from "@mihwar/shared";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma, prismaBase } from "./lib/prisma.js";
import { assertRlsEffective } from "./lib/rlsGuard.js";
import { runWithTenant } from "./lib/tenantContext.js";
import { runGenerationJob } from "./modules/generation/generation.service.js";
import { closePdfEngine } from "./lib/pdf.js";

/**
 * عامل التوليد — خدمة مستقلة عن خادم الويب (Railway: mihwar-worker).
 *
 * لماذا: التوليد ثقيل (دقائق للمادة، ذاكرة لتصيير الشرائح والصوت). داخل خادم الويب كان
 * يزاحم طلبات الأساتذة وقت الذروة، وإعادة النشر كانت تُسقط ما في الطابور. هنا الطابور في
 * القاعدة: الويب يُنشئ المهمة «معلّقة»، والعامل يحجزها ذرّيًا (SKIP LOCKED) وينفّذها داخل
 * سياق جامعتها — فيُضاف عامل ثانٍ للتوسّع دون تعديل سطر، ولا تضيع مهمة بإعادة تشغيل.
 */
installArabicZodErrorMap();
await assertRlsEffective();

const IDLE_MS = 2000;
let active = 0;
let stopping = false;

async function claim(): Promise<{ id: string; tenantId: string; createdById: string } | null> {
  const rows = await prismaBase.$queryRaw<{ id: string; tenantId: string; createdById: string }[]>`SELECT * FROM mihwar_claim_generation_job()`;
  return rows[0] ?? null;
}

async function loop(slot: number) {
  while (!stopping) {
    let job: Awaited<ReturnType<typeof claim>> = null;
    try {
      job = await claim();
    } catch (err) {
      logger.error({ err, slot }, "تعذّر سحب مهمة من الطابور");
    }
    if (!job) {
      await new Promise((r) => setTimeout(r, IDLE_MS));
      continue;
    }
    active++;
    const started = Date.now();
    try {
      await runWithTenant({ tenantId: job.tenantId, userId: job.createdById }, () => runGenerationJob(job.id));
      logger.info({ jobId: job.id, ms: Date.now() - started }, "اكتملت مهمة توليد");
    } catch (err) {
      logger.error({ err, jobId: job.id }, "فشلت مهمة توليد خارج معالجتها");
    } finally {
      active--;
    }
  }
}

logger.info({ concurrency: env.GENERATION_CONCURRENCY }, "عامل التوليد يعمل");
const loops = Array.from({ length: env.GENERATION_CONCURRENCY }, (_, i) => loop(i));

async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal, active }, "عامل التوليد: إيقاف السحب وانتظار المهام الجارية");
  // المهمة التي لا تكتمل قبل مهلة الإيقاف تُعلَّم «منقطعة» لاحقًا ويُردّ حجز رصيدها (markStale).
  const deadline = Date.now() + 25_000;
  while (active > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));
  await Promise.race([Promise.all(loops), new Promise((r) => setTimeout(r, 3000))]);
  await closePdfEngine().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
