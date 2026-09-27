import { prismaBase, withExplicitTenantTx } from "../lib/prisma.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { logger } from "../lib/logger.js";
import { getPlatformSettings } from "../modules/platform/settings.js";
import { harvestSemester } from "../modules/bank/bank.service.js";
import { hourlyNotices } from "./notices.js";

/**
 * الإقفال الآلي للفصول: فصل انتهى وانقضت بعده مهلة الرصد (من إعدادات المالك) يُقفل وحده،
 * فتصير بياناته للقراءة وتُسحب مقرراته للبنك. لا يعتمد على تذكّر أحد.
 *
 * آمن مع أكثر من نسخة خادم: التحديث مشروط بالحالة، فمن يسبق يُقفل والآخر لا يجد شيئًا.
 */
export async function closeDueTerms(now = new Date()): Promise<number> {
  const { term } = await getPlatformSettings();
  const cutoff = new Date(now.getTime() - term.autoCloseDaysAfterEnd * 864e5);
  // الفصول المستحقة عبر الجامعات باستعلام واحد (دالة SECURITY DEFINER)، ثم الإقفال في سياق كل جامعة.
  const due = await prismaBase.$queryRaw<{ tenantId: string; id: string }[]>`SELECT * FROM mihwar_due_terms(${cutoff}::timestamp)`;
  let closed = 0;
  for (const s of due) {
    const r = await withExplicitTenantTx(s.tenantId, (tx) =>
      tx.semester.updateMany({ where: { id: s.id, status: { in: ["ACTIVE", "GRADING"] } }, data: { status: "CLOSED", closedAt: now } }),
    );
    if (!r.count) continue; // نسخة خادم أخرى سبقت
    await runWithTenant({ tenantId: s.tenantId, userId: "system" }, () => harvestSemester(s.tenantId, s.id)).catch((err) =>
      logger.error({ err, semesterId: s.id }, "تعذّر سحب مقررات الفصل للبنك"),
    );
    closed++;
  }
  if (closed) logger.info({ closed }, "أُقفلت فصول انتهت مهلتها");
  return closed;
}

export function startTermCloser(): void {
  const tick = () => {
    void closeDueTerms().catch((err) => logger.error({ err }, "فشل الإقفال الآلي للفصول"));
    void hourlyNotices().catch((err) => logger.error({ err }, "فشل التنبيهات الدورية"));
  };
  setTimeout(tick, 60_000).unref();
  setInterval(tick, 60 * 60_000).unref();
}
